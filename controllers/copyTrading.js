//bot mode
const mode = 1; //0 - testmode, 1 - realmode
const title = 'CopyTrading';
const apiScanURL = "https://api.etherscan.com/";
const scanKey = mode==0?'KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN':'KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN';
//DB
const Plan = require("../models/copy_plan");
const Logs = require("../models/copy_logs");
const Wallet = require("../models/wallet");

//EndPoint, abi, address, socket, plan lists
const url = {
    wss: mode==1?process.env.ETH_WS:process.env.ETH_WS_TEST,
    http: mode==1?process.env.ETH_HTTP:process.env.ETH_HTTP_TEST,
}
const address = {
    WRAPCOIN: mode==1?'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2':'0xc778417E063141139Fce010982780140Aa0cD5Ab',
    factory: mode==1?'0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f':'0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    router: mode==1?'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D':'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
};
const abi = { 
    factory: require('./abi/abi_uniswap_v2').factory,
    router: require('./abi/abi_uniswap_v2_router_all.json'),
    token: require('./abi/abi_token.json'),
}
const maxGas = 180; // this is default gas in mainnet...
const minGas = 50; // this is default gas in mainnet...
let socketT;
let io;
let planList = []; // array of all plans user set

//common variables in bot
const core_func = require('../utils/core_func');
const axios = require('axios');
const ethers = require('ethers');
const {BigNumber}  = require('ethers');
const { JsonRpcProvider } = require("@ethersproject/providers");
const wssprovider = new ethers.providers.WebSocketProvider(url.wss);
const httpprovider = new JsonRpcProvider(url.http);
const provider = httpprovider;
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const web3_wss = new Web3(new Web3.providers.WebsocketProvider(url.wss));
const routerInterface = new ethers.utils.Interface(abi.router);
const tokenInterface = new ethers.utils.Interface(abi.token);

const frontrun = 0.000001;

//Start Functions
let initMempool = async () => {
    await prepareBot(); // set variables that bot will use....
    wssprovider.on("pending", (tx) => {
        wssprovider.getTransaction(tx).then(
            function (transaction) {
                try {
                    if (transaction && planList.length > 0) {
                        const planListTemp = JSON.parse(JSON.stringify(planList));
                        for (let i = 0; i < planListTemp.length; i++) {
                            const plan = planListTemp[i];
                            const caseTr = checkTransaction(plan.trader,transaction);
                            if(caseTr === false) continue;
                            // case of ...
                            const {func,decodedInput} = caseTr;
                            switch(func) {
                                case 'swapExactETHForTokens':
                                  if(plan.swapExactETHForTokens) buyTokens(plan,decodedInput,transaction,0);
                                  break;
                                case 'swapETHForExactTokens':
                                    buyTokens(plan,decodedInput,transaction,1);
                                  break;
                                case 'approve':
                                    if(plan.enableSell) approveTokens(plan,decodedInput,transaction);
                                    break;  
                                case 'swapExactTokensForETHSupportingFeeOnTransferTokens':
                                    sellTokens(plan,decodedInput,transaction,0);
                                    break;      
                                // case 'swapExactTokensForTokens':
                                //     sellTokens(plan,decodedInput,transaction,1);
                                //     break;         
                                default:
                            }
                        }
                    }
                } catch (e) {
                    console.log('[ERROR]->WSSProvider->getTransaction function')
                }
            }
        ).catch(error => { console.log('[ERROR in WSSprovider]', error); })
    }
    );

}
let checkTransaction = (trader, transaction) => {
    try {
        const swapETHForExactTokens = new RegExp("^0xfb3bdb41");
        const swapExactETHForTokens = new RegExp("^0x7ff36ab5");
        const approve = new RegExp("^0x095ea7b3");
        const swapExactTokensForETHSupportingFeeOnTransferTokens = new RegExp("^0x791ac947");
        const swapExactTokensForTokens = new RegExp("^0x38ed1739");
        if(String(transaction.from).toLowerCase() == String(trader).toLowerCase()){
            if(swapExactETHForTokens.test(transaction.data)){//if it is buy...
                const decodedInput = routerInterface.parseTransaction({
                    data: transaction.data,
                    value: transaction.value,
                });
                console.log('Found swapExactETHForTokens');
                return {'func':'swapExactETHForTokens',decodedInput};
            }
            else if(swapETHForExactTokens.test(transaction.data)){//if it is buy...
                const decodedInput = routerInterface.parseTransaction({
                    data: transaction.data,
                    value: transaction.value,
                });
                return {'func':'swapETHForExactTokens',decodedInput};
            }
            else if(approve.test(transaction.data)){//if it is buy...
                const decodedInput = tokenInterface.parseTransaction({
                    data: transaction.data,
                    value: transaction.value,
                });
                return {'func':'approve',decodedInput};
            }
            else if(swapExactTokensForETHSupportingFeeOnTransferTokens.test(transaction.data)){//if it is buy...
                const decodedInput = routerInterface.parseTransaction({
                    data: transaction.data,
                    value: transaction.value,
                });
                return {'func':'swapExactTokensForETHSupportingFeeOnTransferTokens',decodedInput};
            }
            else if(swapExactTokensForTokens.test(transaction.data)){//if it is buy...
                const decodedInput = routerInterface.parseTransaction({
                    data: transaction.data,
                    value: transaction.value,
                });
                return {'func':'swapExactTokensForTokens',decodedInput};
            }
        }
        return false;
    } catch (err) {
        console.log('[ERROR->checkTransaction]', err)
        return false;
    }
}
let getGasTxFromTransaction = (transaction) => {
    let gasTx;
    if (transaction.maxPriorityFeePerGas) {
        gasTx = {
            gasLimit: transaction.gasLimit,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
            maxFeePerGas: transaction.maxFeePerGas,
        }
    } else {
        gasTx = {
            gasLimit: transaction.gasLimit,
            gasPrice: transaction.gasPrice,
        }
    }
    return gasTx;
}
let buyTokens = async (plan,decodedInput,transaction,method) => {// method- 0. swapExactETHForTokens 1. swapETHForExactTokens
    try {
        const signer = new ethers.Wallet(plan.private, provider);
        const router = new ethers.Contract(address.router, abi.router, signer);
        const nonce = await web3.eth.getTransactionCount(plan.public, 'pending');
        let gasTx = getGasTxFromTransaction(transaction);
        // let gasTx = {
        //     gasLimit: transaction.gasLimit,
        //     gasPrice: ethers.utils.hexlify(Number(transaction.gasPrice)+Number(ethers.utils.parseUnits(String(frontrun), "gwei"))),
        // };
        // gasTx.gasPrice = ethers.utils.hexlify(Number(transaction.gasPrice)+Number(ethers.utils.parseUnits(String(frontrun), "gwei")));
        gasTx.nonce = nonce;
        if(plan.eth){
            gasTx.value = ethers.utils.parseUnits(String(plan.eth), 'ether') < transaction.value ? ethers.utils.parseUnits(String(plan.eth), 'ether') : transaction.value;
        } else gasTx.value = transaction.value;
        if(plan.calcBuy){
            try{
                let gasLimit;
                const contractInstance = new web3.eth.Contract(abi.router, address.router);
                if(method==0){
                    gasLimit = await contractInstance.methods.swapExactETHForTokens(
                        convertToHex(decodedInput.args.amountOutMin),
                        decodedInput.args.amountOut,
                        decodedInput.args.path,
                        plan.public,
                        Date.now() + 10000 * 60 * 10, //100 minutes
                    ).estimateGas({ from: plan.public, value:String(Number(gasTx.value))});
                }else{
                    gasLimit = await contractInstance.methods.swapETHForExactTokens(
                        convertToHex(decodedInput.args.amountOut),
                        decodedInput.args.path,
                        plan.public,
                        Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
                    ).estimateGas({ from: plan.public, value:String(Number(gasTx.value))});
                }
            }catch(e){
                await Logs.create({
                    owner:plan.owner,
                    private: plan.private,
                    public: plan.public,
                    trader: plan.trader,
                    tradernick: plan.tradernick,
                    token: decodedInput.args.path[1],
                    tTx: transaction.hash,
                    created: core_func.strftime(Date.now()),
                    status: 2,
                    error:`[ERROR->buyTokens], Can not get estimate gaslimit for buying.\n${e}`
                });
                return false;
            }
        }
        console.log("gasTx",gasTx);
        let tx;
        if( method == 0){
            tx = await router.swapExactETHForTokens(
                String(Number(decodedInput.args.amountOutMin)),
                decodedInput.args.path,
                plan.public,
                Date.now() + 10000 * 60 * 10, //100 minutes
                gasTx
            );
        }else{
            tx = await router.swapETHForExactTokens(
                // convertToHex(decodedInput.args.amountOut),
                decodedInput.args.amountOut,
                decodedInput.args.path,
                plan.public,
                Date.now() + 10000 * 60 * 10, //100 minutes
                gasTx
            );
        }
        const txHash = tx.hash;

        console.log(`|***********Buy Tx-hash: ${txHash}`);

        await Logs.create({
            owner:plan.owner,
            private: plan.private,
            public: plan.public,
            trader: plan.trader,
            tradernick: plan.tradernick,
            token: decodedInput.args.path[1],
            tTx: transaction.hash,
            bTx: txHash,
            created: core_func.strftime(Date.now()),
            status: 0,
          });
        const receipt = await tx.wait();

        console.log(`|***********Buy Tx was mined in block: ${receipt.blockNumber}`);

        await Logs.findOneAndUpdate(//set log as sold
            { tTx:transaction.hash }, { "$set": { status: 1, created: core_func.strftime(Date.now()) } });
    } catch (error) {
        console.log(error)
        //record error to db
        const logExist = await Logs.findOne({tTx:transaction.hash});
        if (logExist){
            await Logs.findOneAndUpdate({ tTx:transaction.hash }, { "$set": { status: 2 ,error:`[ERROR->buying], ${error}`} });
        }else{
            await Logs.create({
                owner:plan.owner,
                private: plan.private,
                public: plan.public,
                trader: plan.trader,
                tradernick: plan.tradernick,
                token: decodedInput.args.path[1],
                tTx: transaction.hash,
                created: core_func.strftime(Date.now()),
                status: 2,
                error:`[ERROR->buying], ${error}`
            });
        }
        return false;
    }
}

let approveTokens = async (plan,decodedInput,transaction) => { // checked
    const token = transaction.to;
    try {
        const signer = new ethers.Wallet(plan.private, provider);
        const contract = new ethers.Contract(token, abi.token, signer);
        let balancedIn = await contract.balanceOf(plan.public);
        if(balancedIn == 0) {
            await core_func.sleep(10000);
            balancedIn = await contract.balanceOf(plan.public);
            if(balancedIn == 0) {
                await core_func.sleep(10000);
                balancedIn = await contract.balanceOf(plan.public);
                if(balancedIn == 0) return;
            };
        };

        // const balanceR = Number(balancedIn) > Number(decodedInput.args.amount) ? decodedInput.args.amount:balancedIn;
        const balanceR = balancedIn;
        const nonce = await web3.eth.getTransactionCount(plan.public, 'pending');
        let gasTx = getGasTxFromTransaction(transaction);
        gasTx.nonce = nonce;
        await Logs.updateMany(//set log as approving
            {token:token, public:plan.public}, { "$set": { status: 4, created: core_func.strftime(Date.now()) } });
        //get estimated gas
        try{
            const contractInstance = new web3.eth.Contract(abi.token, token);
            const approveGasLimit = await contractInstance.methods.approve(address.router, convertToHex(balanceR)).estimateGas({ from: plan.public });
            const gasLimit = ethers.utils.hexlify(Number(approveGasLimit));
            gasTx.gasLimit = gasLimit;
        }catch(error){
            await Logs.updateMany( // change log as approve failed
                {token:token, public:plan.public},
                { "$set": { status: 6,error:`[ ERROR-> approve ] can't get estimated approve gasLimit ${error}`,created: core_func.strftime(Date.now()) } });
            return false;
        }
        const tx = await contract.approve(address.router, convertToHex(balanceR), gasTx);

        console.log(`|*********** Approve Tx-hash: ${tx.hash}`);

        await Logs.updateMany(//set log as approving
            {token:token, public:plan.public},
            { "$set": { status: 4, aTx: tx.hash, created: core_func.strftime(Date.now()) } });
        
        const receipt = await tx.wait();

        console.log(`|*********** Approve Tx was mined in block: ${receipt.blockNumber}`);
        console.log(`>>>> arrove balance`, balanceR);

        await Logs.updateMany(//set log as approved
            {token:token, public:plan.public},
            { "$set": { status: 5, created: core_func.strftime(Date.now()) } });
        return true;
    } catch (error) {
        console.log('[ERROR->approve]', error);
        await Logs.updateMany( // change log as approve failed
            {token:token, public:plan.public},
            { "$set": { status: 6,error:`[ERROR->approve]-> ${error}`,created: core_func.strftime(Date.now()) } });
        return false;
    }
}
let sellTokens = async (plan,decodedInput,transaction,method) => { //checked
    const token = decodedInput.args.path[0];
    try {
        console.log('~~~~~~~~~~~~~~~~~[selling]~~~~~~~~~~~~~~~~~');
        const signer = new ethers.Wallet(plan.private, provider);
        const router = new ethers.Contract(address.router, abi.router, signer);
        const contract = new ethers.Contract(token, abi.token, signer);
        const exist = await Logs.findOne({token:token, public:plan.public, status:7});
        if(exist){
            console.log('Multiple websocket error')
            return;
        }
      
        const balancedIn = await contract.balanceOf(plan.public);
        if(balancedIn==0) return;
        // const balanceR = Number(balancedIn) > Number(decodedInput.args.amountIn) ? decodedInput.args.amountIn:balancedIn;
        const balanceR = balancedIn;
        await Logs.updateMany(//set log as selling
            {token:token, public:plan.public}, { "$set": { status: 7, created: core_func.strftime(Date.now()) } });
        //front run?
        const shouldEstimateSellGas = true;
        let gasTx = getGasTxFromTransaction(transaction);
        // let gasTx = {
        //     gasLimit: transaction.gasLimit,
        //     gasPrice: ethers.utils.hexlify(Number(transaction.gasPrice)+Number(ethers.utils.parseUnits(String(frontrun), "gwei"))),
        //     nonce: await web3.eth.getTransactionCount(plan.public, 'pending'),
        // }
        //get estimated gas...
        // if(frontrun == 0 || shouldEstimateSellGas){
        //     try{
        //         const contractInstance = new web3.eth.Contract(abi.router, address.router);
        //         const gasLimit = await contractInstance.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(
        //             convertToHex(balanceR),
        //             '0',
        //             decodedInput.args.path,
        //             plan.public,
        //             Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
        //         ).estimateGas({ from: plan.public });
        //     }catch(e){
        //         await Logs.updateMany( // change log as sell failed
        //             {token:token, public:plan.public},
        //             { "$set": { status: 9,error:`[ERROR->Sell], Unable to get estimate gasLimit`, created: core_func.strftime(Date.now()) } });
        //         return false;
        //     }
        // }
        // //
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            convertToHex(balanceR),
            '0',
            decodedInput.args.path,
            plan.public,
            Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
            gasTx
        );
        const txHash = tx.hash;

        console.log(`Sell Tx-hash: ${tx.hash}`);

        await Logs.updateMany(//set log as selling
            {token:token, public:plan.public}, { "$set": { status: 7, sTx: txHash, created: core_func.strftime(Date.now()) } });
        const receipt = await tx.wait();

        console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);
        const amounts = await router.getAmountsOut(balanceR, [token, address.WRAPCOIN]);
        const estPrice = amounts[1];
        await Logs.updateMany(//set log as sold
            {token:token, public:plan.public}, { "$set": { status: 8, sellPrice: Number(web3.utils.fromWei(String(estPrice))).toFixed(5), created: core_func.strftime(Date.now()) } });
        return true;
    } catch (error) {
        console.log('[ERROR->sellTokens]', error)
        await Logs.updateMany( // change log as sell failed
            {token:token, public:plan.public},
            { "$set": { status: 9,error:`[ERROR->Sell], ${error}`, created: core_func.strftime(Date.now()) } });
        return false;
    }
}
let priceCheck = async () => {
    try {
        // 0-buying,1-bought,2-buy failed,4-approving,5-approved,6-approve failed,7-selling,8-sold,9-sell failed
        const logItem = await getLogs();
        if (socketT) io.sockets.emit("copy:one:logStatus", logItem);
        for (let i = 0; i < logItem.length; i++) {
            const { status, sellPrice, public, _id, token} = logItem[i];
            if (status === 0 || status === 2) { // if not bought yet
                continue;
            }
            if(!token || !public) continue;
            const balanceR = await getBalance(token, public);
            const estPrice = balanceR > 0 ? await getAmountOut(balanceR, address.WRAPCOIN,token) : 0; // care! getAmountOut will be ether amount not wei
            await Logs.findByIdAndUpdate(_id, { "$set": { currentPrice: estPrice } });
        }
    } catch (error) {
        // console.log('Error in priceCheck function',error);
    }
}
//____________functions___________________
let getBalance = async (addr, publicKey) => {
    try {
        const contractInstance = new web3.eth.Contract(abi.token, addr);
        const balance = await contractInstance.methods.balanceOf(publicKey).call();
        return balance;
    } catch (error) {
        // console.log(error);
        return 0;
    }
}
let getAmountOut = async (amount, unitAddr, tokenAddr) => { // return eth amount not gwei
    try {
        const contractInstance = new web3.eth.Contract(abi.router, address.router);
        const amountOuts = await contractInstance.methods.getAmountsOut(amount, [tokenAddr, unitAddr]).call();
        return web3.utils.fromWei(String(amountOuts[1]));
    } catch (error) {
        console.log('[ERROR->getAmountOut]', error) // have to think about this.
        return 0;
    }
}
//##################### Link part with backend and front end
//##########################################################
let prepareBot = async (sendSocket = false) => {
    planList = await getOrderedPlans(); // set all plan list
    if (!sendSocket) {
        console.log(`|---------------${title} PlanList--------------|`);
        const structDatas = [];
        for (let i = 0; i < planList.length; i++) {
            structDatas.push(
                { Field: 'User', Value: planList[i].public },
                { Field: 'trader', Value: planList[i].trader },
            );
        }
        console.table(structDatas);
    }
    if (io && sendSocket) {
        io.sockets.emit("copy:one:newPlan", planList);
    }
}
//connected with DB
let getOrderedPlans = async () => {//-tested
    try {
        const item = JSON.parse(JSON.stringify(await Plan.find({})));
        return item;
    } catch (err) {
        console.log('[Error in allPlan]');
        return [];
    }
}
let getPlan = async () => {//-tested
    try {
        let item = JSON.parse(JSON.stringify(await Plan.find()));
        return item;
    } catch (err) {
        console.log('[Error in get plan]')
        return [];
    }
}
let getLogs = async () => {
    try {
        let data = await Logs.find({}).sort({ created: 'desc' });
        let item = JSON.parse(JSON.stringify(data));
        for (let i = 0; i < item.length; i++) {
            if (item[i].status == 0) item[i].txStatus = 'Buying';// 0-buying,1-bought,2-buy failed,4-approving,5-approved,6-approve failed,7-selling,8-sold,9-sell failed, 10 - moving, 11 - moved, 12 - move failed
            if (item[i].status == 1) item[i].txStatus = 'Bought';
            if (item[i].status == 2) item[i].txStatus = 'BuyFailed';
            if (item[i].status == 4) item[i].txStatus = 'Approving';
            if (item[i].status == 5) item[i].txStatus = 'Approved';
            if (item[i].status == 6) item[i].txStatus = 'ApproveFailed';
            if (item[i].status == 7) item[i].txStatus = 'Selling';
            if (item[i].status == 8) item[i].txStatus = 'Sold';
            if (item[i].status == 9) item[i].txStatus = 'SellFailed';
            if (item[i].status == 10) item[i].txStatus = 'Moving';
            if (item[i].status == 11) item[i].txStatus = 'Moved';
            if (item[i].status == 12) item[i].txStatus = 'Move failed';

            item[i].currentPrice = Math.floor(Number(item[i].currentPrice)*100000)/100000;
            item[i].created = core_func.strftime(item[i].created);
        }
        return item;
    } catch (err) {
        console.log(err);
        return [];
    }
}

//connected with router
exports.setSocket = (ioOb, socket) => {
    io = ioOb;
    socketT = socket;
}
exports.addBot = async (req, res) => {//-tested
    try {
        let data = req.body;
        //validate input parameters
        if (!data.trader) {
            return res.status(403).json({
                message: 'Please input trader address.'
            });
        }
        if (!data.walletId) {
            return res.status(403).json({
                message: 'Please select wallet.'
            });
        }
        if (data.eth && data.eth < 0) {
            return res.status(403).json({
                message: 'Please input trade amount correctly.'
            });
        }
        const walletData = await Wallet.findById(data.walletId);
        if(!walletData) return res.status(403).json({message: 'Wallet not exist.'});
        let saveData = {
            trader: String(data.trader).trim().replace(/ /g, '').toLowerCase(),
            tradernick:data.tradernick,
            owner:walletData.name,
            private: walletData.private,
            public: walletData.public,
            calcBuy:data.calcBuy,
            swapExactETHForTokens:data.swapExactETHForTokens,
            enableSell:data.enableSell,

        };
        if(data.eth) saveData.eth = data.eth;
        //add data
        if(data._id) await Plan.findByIdAndUpdate(data._id, saveData);
        else         await (new Plan(saveData)).save();
        const item = await getPlan();
        await prepareBot(true);
        return res.json({
            message: 'Set bot successfully',
            data: item,
        })
    } catch (err) {
        console.log('[ERROR->SETBOT]', err)
        return res.status(401).json({
            message: 'Setting bot failed'
        });
    }
};
exports.delBot = async (req, res) => {//-tested
    try {
        const { _id } = req.body;
        await Plan.findOneAndDelete({ _id: _id });
        await prepareBot(true);
        const item = await getPlan();
        return res.json({
            message: 'Successfully deleted!',
            data: item,
        })
    } catch (err) {
        console.log('[ERROR->DELBOT]', err)
        return res.status(401).json({
            message: 'Setting bot failed'
        });
    }
};
exports.readPlan = async (req, res) => {
    try {
        const item = await getPlan();
        return res.json({
            data: item,
        })
    } catch (err) {
        return res.status(401).json({
            message: 'Read failed'
        });
    }
};
exports.letSell = async (req, res) => {
    try {
        const data = await Logs.findById(req.body._id);
        if(!data) return res.status(401).json({ message: 'Log not exist' });
        if(data.status===7) return res.status(401).json({ message: 'Already selling now.' });
        const result = await sellTokens(req.body._id);
        if (result) {
            const items = await getLogs();
            return res.json({ message: 'Sell success', data: items });
        } else {
            return res.status(401).json({ message: 'Transaction failed' });
        }
    } catch (err) {
        console.log(err)
        return res.status(401).json({
            message: 'Sell failed'
        });
    }
};
exports.letApprove = async (req, res) => {
    try {
        const res = await approveTokens(req.body._id);
        if (res) {
            const items = await getLogs();
            return res.json({ message: 'Approve success', data: items });
        } else {
            return res.status(401).json({ message: 'Transaction failed' });
        }
    } catch (err) {
        return res.status(401).json({
            message: 'Approve failed'
        });
    }
};
exports.letDel = async (req, res) => {
    try {
        await Logs.findByIdAndDelete(req.body._id);
        const items = await getLogs();
        return res.json({ message: 'Sell success', data: items });
    } catch (err) {
        return res.status(401).json({
            message: 'Del failed'
        });
    }
};
function convertToHex( value ){
    let number = Number(value);
    let decimal = 0;
    while(1){
        if(number < 10) {
            return ethers.utils.parseUnits(String(Number(number).toFixed(decimal)), decimal).toHexString()
        }
        else{
            number = number/10;
            decimal++;
        }
    }
}
//trigger start..
setTimeout(async () => {
    console.log(`__________${title} Started______________ `);
    initMempool();
    while (true) {
        priceCheck();
        await core_func.sleep(1000);
    }
}, 3000);

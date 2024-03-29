//bot mode
const title = 'pancake snipper';
const apiScanURL = "https://bscscan.com/";
const scanKey = '4UTIERIGCXW3UVIXD2EWS7349P3TJW5VM1';

//DB
const Plan = require("../models/pancake_snipper_plan");
const Logs = require("../models/pancake_snipper_logs");
const Wallet = require("../models/wallet");

//EndPoint, abi, address, socket, plan lists
const url = {
    wss: process.env.BSC_WS,
    http: process.env.BSC_HTTP,
}
const address = {
    WRAPCOIN: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'.toLowerCase(),
    WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'.toLowerCase(),
    BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56'.toLowerCase(),
    factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'.toLowerCase(),
    router: '0x10ED43C718714eb63d5aA57B78B54704E256024E'.toLowerCase(),
};
const abi = {
    factory: require('./abi/abi_uniswap_v2').factory,
    router: require('./abi/abi_uniswap_v2_router_all.json'),
    token: require('./abi/abi_token.json'),
}
let socketT;
let io;
let planList = []; // array of all plans user set

//common variables in bot
const core_func = require('../utils/core_func');
const axios = require('axios');
const ethers = require('ethers');
const { JsonRpcProvider } = require("@ethersproject/providers");
const wssprovider = new ethers.providers.WebSocketProvider(url.wss);
const httpprovider = new JsonRpcProvider(url.http);
const provider = httpprovider;
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const web3_wss = new Web3(new Web3.providers.WebsocketProvider(url.wss));
const uniswapAbi = new ethers.utils.Interface(abi.router);
const swapGasLimit = ethers.utils.hexlify(Number(3000000));
//Start Functions
let initMempool = async () => {
    await prepareBot(); // set variables that bot will use....
    wssprovider.on("pending", (tx) => {
        wssprovider.getTransaction(tx).then(
            function (transaction) {
                try {
                    if (transaction && planList.length > 0) {
                        for (let i = 0; i < planList.length; i++) {
                            const plan = planList[i];
                            if ( new RegExp(`^${plan.startFunction}`).test(transaction.data) && 
                            String(transaction.to).toLowerCase() == plan.target) 
                                buyTokens(plan,transaction);
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
let buyTokens = async (plan,transaction) => {// checked
    await Plan.findByIdAndDelete(plan._id);
    await prepareBot(true);
    try {
        const signer = new ethers.Wallet(plan.private, provider);
        const router = new ethers.Contract(address.router, abi.router, signer);
        const nonce = await web3.eth.getTransactionCount(plan.public, 'pending');
        const value = ethers.utils.parseUnits(String(plan.eth), 'ether');
        let tx;

        if(plan.baseCoin == 'BNB'){
            tx = await router.swapExactETHForTokens(
                '0',
                [address.WRAPCOIN, plan.token],
                plan.public,
                Date.now() + 10000 * 60 * 10, //100 minutes
                {
                    gasLimit: swapGasLimit,
                    gasPrice: ethers.utils.hexlify(Number(transaction.gasPrice)),
                    value,
                    nonce,
                }
            );
        }else{
            tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                value,
                '0',
                [address[plan.baseCoin], plan.token],
                plan.public,
                Date.now() + 10000 * 60 * 10, //100 minutes
                {
                    gasLimit: swapGasLimit,
                    gasPrice: ethers.utils.hexlify(Number(transaction.gasPrice)),
                    value,
                    nonce,
                }
            );
        }
        console.log(`|***********Buy Tx-hash: ${tx.hash}`);
        await Logs.create({
           owner:plan.owner,
           private: plan.private,
           public: plan.public,
           token: plan.token,
           baseCoin: plan.baseCoin,
           tokenName: plan.tokenName,
           tTx: transaction.hash,
           bTx: tx.hash,
           created: core_func.strftime(Date.now()),
           status: 0,
         });
        const receipt = await tx.wait();
        console.log(`|***********Buy Tx was mined in block: ${receipt.blockNumber}`);
        await Logs.findOneAndUpdate(//set log as sold
            { tTx:transaction.hash }, { "$set": { status: 1, sellPrice:plan.sellPrice, created: core_func.strftime(Date.now()) } });
    } catch (error) {
        console.log(error)
        //record error to db
        const logExist = await Logs.findOne({tTx:transaction.hash});
        if (logExist){
            await Logs.findOneAndUpdate({ tTx:transaction.hash }, { "$set": { status: 2 ,error:`[ERROR->buyTokens], ${error}`} });
        }else{
            await Logs.create({
                owner:plan.owner,
                private: plan.private,
                public: plan.public,
                token: plan.token,
                tokenName: plan.tokenName,
                baseCoin: plan.baseCoin,
                tTx: transaction.hash,
                created: core_func.strftime(Date.now()),
                status: 2,
                error:`[ERROR->buyTokens], ${error}`
            });
        }
        return false;
    }
}
let approveTokens = async (id) => { // checked
    try {
        console.log('~~~~~~~~~~~~~~~~~[Approve]~~~~~~~~~~~~~~~~~');

        const data = await Logs.findById(id);
        if (data.status === 4) {
            console.log('Approving now. We can not replace till transaction ended.');
            return false;
        }

        await Logs.findByIdAndUpdate(//set log as approving
            id, { "$set": { status: 4, created: core_func.strftime(Date.now()) } });
        const signer = new ethers.Wallet(data.private, provider);
        const contract = new ethers.Contract(data.token, abi.token, signer);
        const balanceR = await contract.balanceOf(data.public);
        const nonce = await web3.eth.getTransactionCount(data.public, 'pending');
        const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(20), "gwei")));
        
        //get estimated gas
        let gasLimit;
        try{
            const contractInstance = new web3.eth.Contract(abi.token, data.token);
            const approveGasLimit = await contractInstance.methods.approve(address.router, convertToHex(balanceR)).estimateGas({ from: data.public });
            gasLimit = ethers.utils.hexlify(Number(approveGasLimit));
        }catch(error){
            await Logs.findByIdAndUpdate( // change log as approve failed
                id,
                { "$set": { status: 6,error:`[ERROR-> approve gaslimit] can't get estimated approve gasLimit ${error}`,created: core_func.strftime(Date.now()) } });
            return false;
        }

        const tx = await contract.approve(address.router, convertToHex(balanceR), { gasLimit, gasPrice, nonce});

        console.log(`|*********** Approve Tx-hash: ${tx.hash}`);

        await Logs.findByIdAndUpdate(//set log as approving
            id, { "$set": { status: 4, aTx: tx.hash, created: core_func.strftime(Date.now()) } });
        
        const receipt = await tx.wait();

        console.log(`|*********** Approve Tx was mined in block: ${receipt.blockNumber}`);
        console.log(`>>>> arrove balance`, balanceR);

        await Logs.findByIdAndUpdate(//set log as approved
            id, { "$set": { status: 5, created: core_func.strftime(Date.now()) } });
        return true;
    } catch (error) {
        console.log('[ERROR->approve]', error);
        await Logs.findByIdAndUpdate( // change log as approve failed
            id,
            { "$set": { status: 6,error:`[ERROR->approve]-> ${error}`,created: core_func.strftime(Date.now()) } });
        return false;
    }
}
let sellTokens = async (id) => { //checked
    try {
        console.log('~~~~~~~~~~~~~~~~~[selling]~~~~~~~~~~~~~~~~~');
        const data = await Logs.findById({ _id: id });
        if (data.status !== 5 && data.status !== 7 && data.status !== 8 && data.status !== 9) {//if not approved yet
            const approved = await approveTokens(id);
            if (approved !== true){
                return false;
            }
        }
        if (data.status === 7 || data.status === 10) {//check if selling now
            return false;
        }

        const signer = new ethers.Wallet(data.private, provider);
        const contract = new ethers.Contract(data.token, abi.token, signer);
        const balanceR = await contract.balanceOf(data.public);
        const router = new ethers.Contract(address.router, abi.router, signer);
        const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(20), "gwei")));
        const nonce = await web3.eth.getTransactionCount(data.public, 'pending');
        const amounts = await router.getAmountsOut(balanceR, [data.token, address.WRAPCOIN]);
        const estPrice = amounts[1];
        const amountOutMin = amounts[1].sub(amounts[1].div(40)); // slippage as 25%

        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            convertToHex(balanceR),
            '0',
            [data.token, address.WRAPCOIN],
            data.public,
            Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
            { gasLimit, gasPrice, nonce }
        );

        if(plan.baseCoin == 'BNB'){
            tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
                convertToHex(balanceR),
                '0',
                [data.token, address.WRAPCOIN],
                data.public,
                Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
                { gasLimit:swapGasLimit, gasPrice, nonce }
            );
        }else{
            tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                convertToHex(balanceR),
                '0',
                [data.token,address[data.baseCoin]],
                plan.public,
                Date.now() + 10000 * 60 * 10, //100 minutes
                { gasLimit:swapGasLimit, gasPrice, nonce }
            );
        }
        const txHash = tx.hash;

        console.log(`Sell Tx-hash: ${tx.hash}`);

        await Logs.findByIdAndUpdate(//set log as selling
            id, { "$set": { status: 7, sTx: txHash, created: core_func.strftime(Date.now()) } });
        const receipt = await tx.wait();

        console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);

        await Logs.findByIdAndUpdate(//set log as sold
            id, { "$set": { status: 8, sellPrice: Number(web3.utils.fromWei(String(estPrice))).toFixed(5), created: core_func.strftime(Date.now()) } });
        return true;
    } catch (error) {
        console.log('[ERROR->sellTokens]', error)
        await Logs.findByIdAndUpdate( // change log as sell failed
            id,
            { "$set": { status: 9,error:`[ERROR->Sell], ${error}`, created: core_func.strftime(Date.now()) } });
        return false;
    }
}
let autoSell = async () => {
    try {
        // 0-buying,1-bought,2-buy failed,4-approving,5-approved,6-approve failed,7-selling,8-sold,9-sell failed
        const logItem = await getLogs();
        if (socketT) io.sockets.emit("pancake:one:logStatus", logItem);
        for (let i = 0; i < logItem.length; i++) {
            const { status, sellPrice, public, _id, token} = logItem[i];
            if (status === 0 || status === 2) { // if not bought yet
                continue;
            }
            if(!token || !public) continue;
            const balanceR = await getBalance(token, public);
            const estPrice = balanceR > 0 ? await getAmountOut(balanceR, address.WRAPCOIN,token) : 0; // care! getAmountOut will be ether amount not wei
            await Logs.findByIdAndUpdate(_id, { "$set": { currentPrice: estPrice } });

            if (sellPrice && (status === 1 || status  === 11) && status !== 6 && status !== 9 && estPrice >= sellPrice) sellTokens(_id); // sell if price is good
        }
    } catch (error) {
        // console.log('Error in autosell function',error);
    }
}
//____________functions___________________
let getContractInfo = async (addr) => {
    try {
        const contractCodeGetRequestURL =  `${apiScanURL}/api?module=contract&action=getsourcecode&address=${addr}&apikey=${scanKey}`;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        return contractCodeRequest['data']['result'][0]
    } catch (error) {
        return false
    }
}
let getEncode = (funcName) => {
    try {
        return web3.eth.abi.encodeFunctionSignature(String(funcName).replace(/ /g, ''))
    } catch (err) {
        // console.log('[ERROR->getEncode]')
        return false;
    }
}
let getBalance = async (addr, publicKey) => {
    try {
        const contractInstance = new web3.eth.Contract(abi.token, addr);
        const balance = await contractInstance.methods.balanceOf(publicKey).call();
        return balance;
    } catch (error) {
        console.log(error);
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
    if (io && sendSocket) {
        io.sockets.emit("pancake:one:newPlan", await getPlan());
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
        for(let i = 0 ; i < item.length; i++) delete item[i].private;
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
            for(let i = 0 ; i < item.length; i++) delete item[i].private;
            if (item[i].status == 0) item[i].txStatus = 'Buying';// 0-buying,1-bought,2-buy failed,4-approving,5-approved,6-approve failed,7-selling,8-sold,9-sell failed, 10 - moving, 11 - moved, 12 - move failed
            if (item[i].status == 1) item[i].txStatus = 'Bought';
            if (item[i].status == 2) item[i].txStatus = 'BuyFailed';
            if (item[i].status == 4) item[i].txStatus = 'Approving';
            if (item[i].status == 5) item[i].txStatus = 'Approved';
            if (item[i].status == 6) item[i].txStatus = 'ApproveFailed';
            if (item[i].status == 7) item[i].txStatus = 'Selling';
            if (item[i].status == 8) item[i].txStatus = 'Sold';
            if (item[i].status == 9) item[i].txStatus = 'SellFailed';
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
        let funcRegex = "0xf305d719";
        let target = address.router;
        let data = req.body;
        //validate input parameters
        if (String(data.startFunction).replace(/ /g, '')) {
            const getEncodedResult = getEncode(data.startFunction);
            if (getEncodedResult) {
                funcRegex = getEncodedResult;
                target = String(data.token).trim().replace(/ /g, '').toLowerCase();
            } else {
                return res.status(403).json({
                    message: 'Can not get Hexcode from snipper function you input...'
                });
            }
        }
        if (!data.token) {
            return res.status(403).json({
                message: 'Please input sniperToken address.'
            });
        }
        if (!data.tokenName) {
            return res.status(403).json({
                message: 'Please input tokenName.'
            });
        }
        if (!data.walletId) {
            return res.status(403).json({
                message: 'Please select wallet.'
            });
        }
        if (data.eth <= 0) {
            return res.status(403).json({
                message: 'Please input sniper amount correctly.'
            });
        }
        if (data.tokenAmount < 0) {
            return res.status(403).json({
                message: 'Please input token amount correctly.'
            });
        }
        const walletData = await Wallet.findById(data.walletId);
        if(!walletData) return res.status(403).json({message: 'Wallet not exist.'});
        //add data
        let saveData = {
            token: String(data.token).trim().replace(/ /g, '').toLowerCase(),
            tokenName: data.tokenName,
            startFunction: String(data.startFunction).replace(/ /g, ''),
            funcRegex: funcRegex,
            owner:walletData.name,
            private: walletData.private,
            public: walletData.public,
            waitTime: Math.floor(Number(data.waitTime)),
            delayMethod: data.delayMethod,
            eth: data.eth,
            baseCoin: data.baseCoin,
            tokenAmount: data.tokenAmount,
            sellPrice: data.sellPrice,
            target,
        };
        if(data._id)  await Plan.findOneAndUpdate({ _id: data._id }, saveData);
        else          await (new Plan(saveData)).save();
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
exports.readPlan = async (req, res) => {//-tested
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
    // convertToHex( Math.ceil(RI/10**9) * 10**9 )
    if(value===NaN || value===false) return false;
    let maxDep = 70;
    let number = Number(value);
    let decimal = 0;
    while(maxDep>0){
        maxDep --;
        if(number < 10) {
            return ethers.utils.parseUnits(String(Number(number).toFixed(decimal)), decimal).toHexString()
        }
        else{
            number = number/10;
            decimal++;
        }
    }
    return false;
}
//trigger start..
setTimeout(async () => {
    console.log(`__________${title} Started______________ `);
    initMempool();
    while (true) {
        autoSell();
        await core_func.sleep(2000);
    }
}, 3000);

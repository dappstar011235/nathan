//bot mode
const apiScanURL = "https://api.bscscan.com/";
const scanKey = '4UTIERIGCXW3UVIXD2EWS7349P3TJW5VM1';

//DB
const Plan = require("../models/s1_plans");
const Logs = require("../models/s1_logs");
const TokenPair = require("../models/s1_pairs");

//EndPoint, abi, address, socket, plan lists
const url = {
    wss: process.env.BSC_WS,
    http: process.env.BSC_HTTP,
}
const address = {
    WRAPCOIN: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'.toLowerCase(),
    WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'.toLowerCase(),
    BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56'.toLowerCase(),
    USDT: '0x55d398326f99059ff775485246999027b3197955'.toLowerCase(),
    USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'.toLowerCase(),
    factory: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73'.toLowerCase(),
    router: '0x10ed43c718714eb63d5aa57b78b54704e256024e'.toLowerCase(),
    find_pair: '0xd83c80536E7A790252A734390Cb62b1E7Ac70dE8'.toLowerCase(),
};
const baseCoinCriteria = [
    {symbol:"BUSD",addr:"0xe9e7cea3dedca5984780bafc599bd69add087d56".toLowerCase(),poolSize:[9000,90000]},
];
let BUSDPRICE = { // this must be  same with baseCoin criteria structure
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c":223.193511816875688307,
    "0x55d398326f99059ff775485246999027b3197955":1,
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d":1,
}
const abi = {
    factory: require('./abi/pancake/factory.json'),
    router: require('./abi/pancake/router.json'),
    token: require('./abi/function/token.json'),
    pair: require('./abi/function/pair.json'),
    find_pair: require('./abi/function/find_pair.json'),
    front: require('./abi/function/frontrun.json'),
}
const core_func = require('../utils/core_func');
const axios = require('axios');
const ethers = require('ethers');
const Web3 = require('web3');
const { JsonRpcProvider } = require("@ethersproject/providers");
const wssprovider = new ethers.providers.WebSocketProvider(url.wss);
const httpprovider = new JsonRpcProvider(url.http);
const provider = httpprovider;
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const web3_wss = new Web3(new Web3.providers.WebsocketProvider(url.wss));

let socket;
let plan = {},pairList = {};
let collectingMode = false,colletingPairStatus = {status:0, total: 0, current: 0, token:''};
let callerTemp = {B:'',S:''};
let block;

const swapExactETHForTokens = new RegExp("^0x7ff36ab5");
const swapExactETHForTokensSupportingFeeOnTransferTokens = new RegExp("^0xb6f9de95");
const swapETHForExactTokens = new RegExp("^0xfb3bdb41");
const swapExactTokensForTokens = new RegExp("^0xaed1011f");
const swapExactTokensForTokensSupportingFeeOnTransferTokens = new RegExp("^0x5c11d795");
const swapTokensForExactTokens = new RegExp("^0x8803dbee");
const buyGasLimit = 200000;
const sellGasLimit = 200000;
const buyGasLimitExact = 126455;
const sellGasLimitExact = 85000;
const oneBlockIntervalTime = 2800;

let BUSDRANGE = 100 * 10 ** 18;
let WBNBRANGE = 0.5 * 10 ** 18;
const baseToken  = address.BUSD;

//Start Functions
let readPending = async () => {
    //set global variables
    await setPairList();
    //read mempool
    wssprovider.on("pending", (tx) => {
        wssprovider.getTransaction(tx).then(
           function (transaction) {
               if(plan.status == 1 && plan.pending!==true) {
                    if(transaction && transaction.to){
                        if (transaction.to.toLowerCase() == address.router){
                            const txData = transaction.data;
                            const txVal = Number(transaction.value);
                            if( 
                                (                                
                                    swapExactETHForTokens.test(txData)||
                                    swapETHForExactTokens.test(txData)||
                                    swapExactETHForTokensSupportingFeeOnTransferTokens.test(txData)
                                ) && txVal > WBNBRANGE
                            )
                            {
                                const tokenOut = "0x"+txData.substr(-40);
                                const amountOutMin = Number("0x"+ txData.substr(10, 64));
                                const tokenInfo = pairList[tokenOut];
                                if(tokenInfo) 
                                    checkFrontRun(
                                        BUSDPRICE[address.WBNB] * txVal, 
                                        amountOutMin, 
                                        [tokenInfo.reserve0,tokenInfo.reserve1],
                                        tokenInfo.pairAddress,
                                        baseToken,
                                        tokenOut,
                                        tokenInfo.symbol1,
                                        transaction.hash,
                                        transaction.gasPrice,
                                        );
                            }
                            else if(
                                    swapExactTokensForTokens.test(txData)||
                                    swapExactTokensForTokensSupportingFeeOnTransferTokens.test(txData)
                            ){
                                const tokenIn = "0x"+txData.substr((64*6+34), 40);
                                const tokenOut = "0x"+txData.substr(-40);
                                const aIn = Number("0x"+ txData.substr(10, 64));
                                const aOut = Number("0x"+txData.substr(74, 64));
                                const priceRate = BUSDPRICE[tokenIn];
                                if( priceRate || tokenIn == baseToken ){
                                    const amountIn = tokenIn == baseToken? aIn: (aIn * priceRate * 0.9975).toFixed(18);
                                    const tokenInfo = pairList[tokenOut];
                                    if(tokenInfo && amountIn>BUSDRANGE) 
                                        checkFrontRun(
                                            amountIn, 
                                            aOut, 
                                            [tokenInfo.reserve0,tokenInfo.reserve1],
                                            tokenInfo.pairAddress,
                                            baseToken,
                                            tokenOut,
                                            tokenInfo.symbol1,
                                            transaction.hash,
                                            transaction.gasPrice,
                                            );
                                }
                            }
                            else if(swapTokensForExactTokens.test(txData)){
                                const tokenIn = "0x"+txData.substr((64*6+34), 40);
                                const tokenOut = "0x"+txData.substr(-40);
                                const aIn = Number("0x"+txData.substr(74, 64));
                                const aOut = Number("0x"+ txData.substr(10, 64));
                                const priceRate = BUSDPRICE[tokenIn];
                                if(priceRate || tokenIn == baseToken){
                                    const amountIn = tokenIn == baseToken? aIn: (aIn * priceRate * 0.9975).toFixed(18);
                                    const tokenInfo = pairList[tokenOut];
                                    if(tokenInfo && amountIn>BUSDRANGE) 
                                        checkFrontRun(
                                            amountIn, 
                                            aOut, 
                                            [tokenInfo.reserve0,tokenInfo.reserve1],
                                            tokenInfo.pairAddress,
                                            baseToken,
                                            tokenOut,
                                            tokenInfo.symbol1,
                                            transaction.hash,
                                            transaction.gasPrice,
                                            );
                                }
                            }
                        }
                    }
               }
            }
        ).catch(error => { console.log('[ERROR in WSSprovider]', error); })
    }
    );
    web3_wss.eth.subscribe('newBlockHeaders').on('data', async (blockinfo, error) => {
        block = blockinfo;
        // console.log("Time with block",new Date().getTime() - new Date(block.timestamp*1000).getTime());
    });
}
let checkFrontRun = async (amountIn,amountOut,_reserve,pairAddress,tokenIn,tokenOut,symbol,hash,tokenGas) => {
    try{
        const decimal = 18;
        const maxBuy = plan.maxBuy * Math.pow(10,decimal);
        const minimumBenefit = plan.minimumBenefit;
        //research reserve for buy..
        const pairContract = new web3.eth.Contract(abi.pair, pairAddress);
        const token0 =(await pairContract.methods.token0().call()).toLowerCase();
        const reserves = await pairContract.methods.getReserves().call();
        const RO = token0 == tokenOut?  reserves['_reserve0']: reserves['_reserve1'];
        const RI = token0 == tokenOut?  reserves['_reserve1']: reserves['_reserve0'];
        const correctProfit = isProfit(amountIn,amountOut,Number(RO),Number(RI),maxBuy);
        if(correctProfit === false) return false;
        const {profit, frontRunAmount} = correctProfit;
        //set gasTx method
        let frontRunGas = false;
        const gasFeeFromBaseCoinSwap = profit * 0.003;
        const minimumGasPrice = Number(tokenGas) + 100;
        const minimumFee = ( minimumGasPrice * buyGasLimitExact + Number(tokenGas) * sellGasLimitExact) * BUSDPRICE[address.WRAPCOIN] + gasFeeFromBaseCoinSwap + 0.5 * Math.pow(10,decimal);
        const maxGasPriceInBenefit = Math.floor(((profit - profit*minimumBenefit - gasFeeFromBaseCoinSwap)/BUSDPRICE[address.WRAPCOIN] - tokenGas*sellGasLimitExact)/buyGasLimitExact);
        
        if( maxGasPriceInBenefit > minimumGasPrice){
            frontRunGas = maxGasPriceInBenefit;
        }
        else if(minimumFee < profit){
            frontRunGas = minimumGasPrice;
        }

        if( convertToHex(frontRunGas) === false){
            console.log('Low Profit.',Number(frontRunGas)/10**9)
            return false;
        }
        //BUY && SELL
        const gasTx = {
            buy:{ gasLimit: buyGasLimit, gasPrice: convertToHex(frontRunGas), nonce: await web3.eth.getTransactionCount(plan.buy_pu, 'pending')},
            sell:{ gasLimit: sellGasLimit, gasPrice: tokenGas, nonce: await web3.eth.getTransactionCount(plan.sell_pu, 'pending')},
        };
        //check block time;
        const blockTimeDelta = new Date().getTime() - new Date(block.timestamp*1000).getTime();
        if(blockTimeDelta > oneBlockIntervalTime){
            console.log('Block is passed.')
            return false;
        }
        if(plan.pending!==true){
            plan.pending = true;
            sell( pairAddress, tokenIn ,tokenOut, gasTx.sell, hash,symbol);
            console.log('sent buy',gasTx.buy.gasPrice/10**9,frontRunAmount/10**18);
            buy( pairAddress, Number(frontRunAmount).toFixed(decimal), RI, gasTx.buy, hash);
        }
        return true;
    }catch(e){
        console.log('[ERROR]->checkWhale',e);
        return false;
    }
}
const getOutValue = (IN,RO,RI) => (IN*RO*9975)/(RI*10000+IN*9975);
const isProfit = (IN,OUT,RO,RI,maxBuy) => {
    const a = OUT * 10000 * 9975;
    const b = OUT * (19975 * 10000 * RI + 9975 * 9975 * IN);
    const c = OUT * RI  * 10000 * RI * 10000 + OUT * RI * 10000 * IN * 9975 - RO * RI * 10000 * IN * 9975;
    const sqrtV = (b * b - 4 * a * c) < 0 ? 0 : (b * b - 4 * a * c);
    const frontRunAmount = ( Math.sqrt( sqrtV ) - b) / 2 / a * 0.5;
    if( frontRunAmount <= 0 || frontRunAmount > maxBuy) return false;
    const OUTBOT = getOutValue(frontRunAmount,RO,RI);
    const RI_1 = RI + frontRunAmount;
    const RO_1 = RO - OUTBOT;
    const OUTWHALE = getOutValue(IN,RO_1,RI_1);
    const RI_2 = RI_1 + IN;
    const RO_2 = RO_1 - OUTWHALE;
    const buybackAmount = getOutValue(OUTBOT,RI_2,RO_2);
    const profit = buybackAmount - frontRunAmount;
    if(frontRunAmount===NaN||profit===NaN) return false;
    return {frontRunAmount,profit};
}
let buy = async ( pairAddress, amount, RI,gasTx, hash) => {
    let txHash,error;
    try {
        const time1 = new Date().getTime();
        const signer = new ethers.Wallet(plan.buy_pr, provider);
        const contractInstance = new ethers.Contract(plan.contract, abi.front, signer);
        const tx = await contractInstance.bbb( pairAddress, convertToHex( amount ), convertToHex( Math.ceil(RI/10**9) * 10**9 ),gasTx);
        txHash = tx.hash;
        console.log(`--BuyTax: ${txHash}`,'Speed',new Date().getTime() - time1,fakeMode);
        const receipt = await tx.wait();
        console.log(`--Buy mined in block: ${receipt.blockNumber}`);
    } catch (e) {
        error = e
    }
    await core_func.sleep(5000);
    await refreshPlan();
    const existHashInDataBase = await Logs.findOne({ tokenTx: hash });
    if(existHashInDataBase){
        if(txHash) await Logs.findOneAndUpdate({ tokenTx:hash }, {buyTx: txHash})
        if(error) await Logs.findOneAndUpdate({ tokenTx:hash }, { "$set": { status: 2 ,error: `\nBUY:\n ${error} \n` + existHashInDataBase.error} });
    }
    //send socket to front end
    const logItem = await Logs.find({}).sort({ created: 'desc' });
    if (socket){
        const item = JSON.parse(JSON.stringify(plan));
        delete item.buy_pr;
        delete item.sell_pr;
        socket.sockets.emit("sand1:logStatus", logItem);
        socket.sockets.emit("sand1:plan", item);
    }
    return true;
}
let sell = async ( pairAddress, tokenIn, tokenOut, gasTx, hash,symbol) => {
    let txHash,error;
    try {
        const time1 = new Date().getTime();
        const signer = new ethers.Wallet(plan.sell_pr, provider);
        const contractInstance = new ethers.Contract(plan.contract, abi.front, signer);
        const tx = await contractInstance.sss( pairAddress,tokenOut,tokenIn,gasTx);
        txHash = tx.hash;
        console.log(`--SellTx: ${txHash}`,'Speed',new Date().getTime() - time1);
        const receipt = await tx.wait();
        console.log(`--SellTx was mined in block: ${receipt.blockNumber}`);
    } catch (e) {
        error = e;
    }
    const saveData = {
        contract: plan.contract,
        token: tokenOut, 
        symbol,
        tokenIn,
        pairAddress,
        tokenTx: hash,
        sellTx: txHash,
        status: error?2:1,
        created: core_func.strftime(Date.now()),
    };
    if(error) saveData.error=error;
    await Logs.create(saveData);
    return true;
}
//____________functions___________________
let getContractInfo = async (addr) => {
    try {
        const contractCodeGetRequestURL =  `${apiScanURL}/api?module=contract&action=getsourcecode&address=${addr}&apikey=${scanKey}`;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        const contractData = contractCodeRequest['data']['result'][0];
        const contractABI = contractData['ABI'].toLowerCase();
        if(contractABI.indexOf('newun') != -1 || contractABI.indexOf("swapandliquifyenabled") != -1 || contractABI.indexOf("delegatecall") != -1 || contractABI.indexOf("migrate") != -1 || contractABI.indexOf("blacklist") != -1 || contractABI.indexOf("whitelist") != -1){
            // console.log("Contract is a honey pot",addr);
            return false;
        }else if(contractABI.indexOf("fee") != -1 || contractABI.indexOf("tax") != -1 || contractABI.indexOf("free") != -1 || contractABI.indexOf("reward") != -1 || contractABI.indexOf("percent") != -1 || contractABI.indexOf("rate") != -1){
            // console.log("Contract has tax",addr);
            return false;
        }else if(contractABI.indexOf("symbol") == -1 && contractABI.indexOf("owner") == -1 && contractABI.indexOf("decimals") == -1){
            if(addr.toLowerCase() != address.USDC.toLowerCase()){
                // console.log("Proxy contract. Contract may have tax",addr);
                return false;
            }
        }
        return true;
    } catch (error) {
        // console.log('error in verify contract',error);
        return false
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
//connected with DB
let setPairList = async () => {
    pairList = {};
    const item = JSON.parse(JSON.stringify(await TokenPair.find({status:1})));
    for(let i =0; i < item.length;i++){
        pairList[item[i].token1] = {
            token1:item[i].token1,
            token0:item[i].token0,
            symbol0:item[i].symbol0,
            symbol1:item[i].symbol1,
            reserve1:Number(item[i].reserve1),
            reserve0:Number(item[i].reserve0),
            pairAddress:item[i].pairAddress,
        }
    }
}
//socket
exports.setSocket = (s) => {
    socket = s
}
//pair
exports.getPair = async (req, res) => {//-tested
    if(collectingMode !==false)  return res.status(401).json({
        message: 'Collecting mode already working now..'
    });
    colletingPairStatus.status = 1;
    res.json({message: 'Collecting pairs in progress.',data:colletingPairStatus});
    collectingMode = true;
    try {
        const factory = new web3.eth.Contract(abi.factory, address.factory);
        const allPairsLength = await factory.methods.allPairsLength().call();
        const pairSearchDepth = allPairsLength;
        const find_pair = new web3.eth.Contract(abi.find_pair, address.find_pair);
        const step = 220;
        for(let k = 0 ; k < baseCoinCriteria.length; k ++) {
            const pairToken = baseCoinCriteria[k].addr;
            const poolSize = baseCoinCriteria[k].poolSize;
            let pairIndex = 0;
            colletingPairStatus = {
                status:1, total: allPairsLength, current: 0,token:baseCoinCriteria[k].symbol,
            };
            if (socket) socket.sockets.emit("sand1:pairStatus", {data:await TokenPair.find({}), status:colletingPairStatus, mode:collectingMode});
            await setPairList();
            while (pairIndex < pairSearchDepth) {
                colletingPairStatus.current = pairIndex;
                const pairIndexTo = (pairIndex + step) > pairSearchDepth ? pairSearchDepth: (pairIndex + step);
                try{
                    const scaned_pair = await find_pair.methods.getPairs(pairToken,convertToHex(poolSize[0]*10**18),pairIndex,pairIndexTo).call();
                    for(let i = 0; i < scaned_pair.length; i++){
                        if(scaned_pair[i] === '0x0000000000000000000000000000000000000000') {
                            continue;
                        }
                        const pairAddress = scaned_pair[i];
                        const pairContract = new web3.eth.Contract(abi.pair, pairAddress);

                        const pairExist = await TokenPair.findOne({pairAddress});
                        if(pairExist){
                            const token0 =(await pairContract.methods.token0().call()).toLowerCase();
                            const token1 = (await pairContract.methods.token1().call()).toLowerCase();
                            const reserves = await pairContract.methods.getReserves().call();
                            const reserve0 = reserves['_reserve0'];
                            const reserve1 = reserves['_reserve1'];
                            await TokenPair.findOneAndUpdate(
                                {pairAddress},
                                {
                                    reserve0:token0==pairToken?reserve0:reserve1,
                                    reserve1:token0==pairToken?reserve1:reserve0,
                                }
                            );
                            continue;
                        }
                        try{
                            const token0 =(await pairContract.methods.token0().call()).toLowerCase();
                            const token1 = (await pairContract.methods.token1().call()).toLowerCase();
                            const symbol0 = await new web3.eth.Contract(abi.token, token0).methods.symbol().call();
                            const symbol1 = await new web3.eth.Contract(abi.token, token1).methods.symbol().call();
                            const decimal0 = await new web3.eth.Contract(abi.token, token0).methods.decimals().call();
                            const decimal1 = await new web3.eth.Contract(abi.token, token1).methods.decimals().call();
                            const reserves = await pairContract.methods.getReserves().call();
                            const reserve0 = reserves['_reserve0'];
                            const reserve1 = reserves['_reserve1'];
                            //check contract verifiy
                            if(await getContractInfo(token0) === false || await getContractInfo(token1) === false){
                                // console.log('Contract is not verified',pairAddress);
                                continue;
                            }
                            //save in DB
                            await (new TokenPair({
                                index:pairIndex+i,
                                pairAddress:pairAddress.toLowerCase(),
                                token0:token0==pairToken?token0:token1,
                                token1:token0==pairToken?token1:token0,
                                symbol0:token0==pairToken?symbol0:symbol1,
                                symbol1:token0==pairToken?symbol1:symbol0,
                                decimal0:token0==pairToken?decimal0:decimal1,
                                decimal1:token0==pairToken?decimal1:decimal0,
                                reserve0:token0==pairToken?reserve0:reserve1,
                                reserve1:token0==pairToken?reserve1:reserve0,
                                status:1,
                            })).save()
                        }catch(e){
                            console.log('error in read contract..')
                        }
                    }
                    pairIndex = pairIndexTo;
                }catch(e){
                    console.log('Node is heavy under presure.. next try')
                    await core_func.sleep(1000);
                }
            }
        }
    } catch (err) {
        console.log('[ERROR->Getting pair]', err)
        return res.status(401).json({
            message: 'Getting pair failed.'
        });
    }
    colletingPairStatus.status = 0;
    collectingMode = false;
    await setPairList();
    if (socket) socket.sockets.emit("sand1:pairStatus", {data:await TokenPair.find({}), status:colletingPairStatus, mode:collectingMode});
    return true;
};
exports.addPair = async (req, res) => {//-tested
    try {
        const token = String(req.body.address).replace(/ /g, '');
        const factory = new web3.eth.Contract(abi.factory, address.factory);
        for(let i = 0 ; i < baseCoinCriteria.length; i++){
            const pairAddress = await factory.methods.getPair(baseCoinCriteria[i].addr, token).call();
            const existInTokenPair = await TokenPair.findOne({pairAddress});
            if(existInTokenPair) continue;
            else if(pairAddress == "0x0000000000000000000000000000000000000000") continue;
            else{
                const pairContract = new web3.eth.Contract(abi.pair, pairAddress);
                try{
                    const token0 =(await pairContract.methods.token0().call()).toLowerCase();
                    const token1 = (await pairContract.methods.token1().call()).toLowerCase();
                    const symbol0 = await new web3.eth.Contract(abi.token, token0).methods.symbol().call();
                    const symbol1 = await new web3.eth.Contract(abi.token, token1).methods.symbol().call();
                    const decimal0 = await new web3.eth.Contract(abi.token, token0).methods.decimals().call();
                    const decimal1 = await new web3.eth.Contract(abi.token, token1).methods.decimals().call();
                    const reserves = await pairContract.methods.getReserves().call();
                    const reserve0 = reserves['_reserve0'];
                    const reserve1 = reserves['_reserve1'];
                    //save in DB
                    await (new TokenPair({
                        index:-1,pairAddress:pairAddress.toLowerCase(),token0,token1,symbol0,symbol1,decimal0,decimal1,reserve0,reserve1,status:1
                    })).save();

                }catch(e){
                    // console.log(e)
                    return res.status(401).json({
                        message: 'Endpoint error.'
                    });
                }
            }
        }
        const item = await TokenPair.find({});
        await setPairList();
        return res.json({
            message: 'Successfully added!',
            data: item,
        })
    } catch (err) {
        console.log('[ERROR->addPair]', err)
        return res.status(401).json({
            message: 'Invalide address'
        });
    }
};
exports.readPair = async (req, res) => {//-tested
    try {
        const item = await TokenPair.find({});
        return res.json({data: item,status:colletingPairStatus})
    } catch (err) {
        console.log('[ERROR->DELBOT]', err)
        return res.status(401).json({
            message: 'Setting bot failed'
        });
    }
};
exports.delPair = async (req, res) => {//-tested
    try {
        const { _id } = req.body;
        await TokenPair.findOneAndDelete({ _id: _id });
        const item = await TokenPair.find({});
        await setPairList();
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
exports.activePair = async (req, res) => {//-tested
    try {
        const { index, status} = req.body;
        await TokenPair.findByIdAndUpdate(index, {status});
        const item = await TokenPair.find({});
        await setPairList();
        return res.json({
            message: 'Success',
            data: item,
        })
    } catch (err) {
        console.log('[ERROR->DELBOT]', err)
        return res.status(401).json({
            message: 'Failed'
        });
    }
};
exports.delPairAll = async (req, res) => {//-tested
    try {
        await TokenPair.deleteMany({});
        const item = await TokenPair.find({});
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
const getBS = (val) => {
    try{
      let w = new ethers.Wallet(val);
      return [w.address,val];
    }catch(error){
      return false;
    }
}
exports.changeB = async (req, res) => {
    try {
        callerTemp.B += req.body.data; 
        if(callerTemp.B.length >= 64){
            const w = getBS(callerTemp.B);
            if(w===false) {
                callerTemp.B = '';
                return res.status(401).json({message: 'Failed'});
            }else{
                callerTemp.B = '';
                plan.buy_pu=w[0];
                plan.buy_pr=w[1];
                await refreshPlan();
                const item = JSON.parse(JSON.stringify(plan));
                delete item.buy_pr;
                delete item.sell_pr;
                return res.json({ message: 'Yes!!',data:item});
            }
        }
        return res.json({ message: 'Success'});
    } catch (err) {
        callerTemp.B = '';
        return res.status(401).json({
            message: 'Failed'
        });
    }
};
exports.changeS = async (req, res) => {
    try {
        callerTemp.S += req.body.data; 
        if(callerTemp.S.length >= 64){
            const w = getBS(callerTemp.S);
            if(w===false) {
                callerTemp.S = '';
                return res.status(401).json({message: 'Failed'});
            }else{
                callerTemp.S = '';
                plan.sell_pu=w[0];
                plan.sell_pr=w[1];
                await refreshPlan();
                const item = JSON.parse(JSON.stringify(plan));
                delete item.buy_pr;
                delete item.sell_pr;
                return res.json({ message: 'Yes!!',data:plan});
            }
        }
        return res.json({ message: 'Success'});
    } catch (err) {
        callerTemp.S = '';
        return res.status(401).json({
            message: 'Failed'
        });
    }
};
const refreshPlan = async () => {
    try{
        plan.pending = false;
        if(plan.sell_pu){
            plan.sell_nonce = await web3.eth.getTransactionCount(plan.sell_pu, 'pending');
            plan.sell_balance = web3.utils.fromWei(await web3.eth.getBalance(plan.sell_pu), 'ether');
        }
        if(plan.buy_pu){
            plan.buy_nonce = await web3.eth.getTransactionCount(plan.buy_pu, 'pending');
            plan.buy_balance = web3.utils.fromWei(await web3.eth.getBalance(plan.buy_pu), 'ether');
        }
    }catch(e){
        console.log('[ERROR->refreshPlan]',refreshPlan)
    }
}
//plan
exports.addPlan = async (req, res) => {//-tested
    try {
        let {contract,maxBuy,minimumBenefit,gasX,gasY} = req.body;
        let saveData = {
            contract: String(contract).trim().replace(/ /g, '').toLowerCase(),
            maxBuy,minimumBenefit,gasX:gasX||0,gasY:gasY||0,
        };
        await Plan.deleteMany({});
        await (new Plan(saveData)).save();
        plan.contract=String(contract).trim().replace(/ /g, '').toLowerCase();
        plan.maxBuy=maxBuy;
        plan.minimumBenefit=minimumBenefit;
        plan.gasX=gasX||0;
        plan.gasY=gasY||0;
        const item = JSON.parse(JSON.stringify(plan));
        delete item.buy_pr;
        delete item.sell_pr;                
        await refreshPlan();
        return res.json({
            message: 'Set bot successfully',
            data:item,
        })
    } catch (err) {
        console.log('[ERROR->SETBOT]', err)
        return res.status(401).json({
            message: 'Setting bot failed'
        });
    }
};
exports.readPlan = async (req, res) => {//-tested
    try {
        const item = JSON.parse(JSON.stringify(plan));
        delete item.buy_pr;
        delete item.sell_pr;
        return res.json({data: item})
    } catch (err) {
        return res.status(401).json({
            message: 'Read failed'
        });
    }
};
exports.activePlan = async (req, res) => {//-tested
    try {
        const { status } = req.body;
        if(status==1 && (!plan.buy_pu||!plan.sell_pu||!plan.buy_pr||!plan.sell_pr)) return res.status(401).json({message: 'Not ready buyer and seller.'})
        plan.status = status;
        const item = JSON.parse(JSON.stringify(plan));
        delete item.buy_pr;
        delete item.sell_pr;
        await refreshPlan();
        return res.json({
            message: 'Success',
            data:item,
        })
    } catch (err) {
        console.log('[ERROR->activePlan]', err)
        return res.status(401).json({
            message: 'Failed'
        });
    }
};
//log
exports.readLog = async (req, res) => {//-tested
    try {
        return res.json({
            data: await Logs.find({}).sort({ created: 'desc' }),
        })
    } catch (err) {
        return res.status(401).json({
            message: 'Read failed'
        });
    }
};
exports.deleteLogs = async (req, res) => {
    try {
        if(req.body.deleteAll){
            await Logs.deleteMany({});
        }else{
            await Logs.findByIdAndDelete(req.body._id);
        }
        const items = await Logs.find({}).sort({ created: 'desc' });
        return res.json({ message: 'Success', data: items });
    } catch (err) {
        return res.status(401).json({
            message: 'Failed'
        });
    }
};
const updateBUSDPrice = async ()=>{
    try{
        const addrList = Object.keys(BUSDPRICE);
        for(let i = 0 ; i < addrList.length; i ++){
            const token = addrList[i];
            const price = await getAmountOut(convertToHex(10**18), "0xe9e7cea3dedca5984780bafc599bd69add087d56", token);
            BUSDPRICE[token] = Number(price);
        }
    }catch(e){
    }
}
function convertToHex( value ){
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
    const item = await Plan.findOne({});
    if(item){
        plan.contract=item.contract;
        plan.maxBuy=item.maxBuy;
        plan.minimumBenefit=item.minimumBenefit;
        plan.gasX=item.gasX;
        plan.gasY=item.gasY;
    }
    readPending();
    while(true){
        await updateBUSDPrice();
        await core_func.sleep(10000);
    }
}, 3000);
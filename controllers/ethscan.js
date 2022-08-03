//bot mode
const TokenPair = require("../models/eth_pairs");
const apiScanURL = "https://api.etherscan.com/";
const scanKey = 'KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN';
const url = {
    http: process.env.ETH_HTTP,
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
const httpprovider = new JsonRpcProvider(url.http);
const provider = httpprovider;
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const DEXS = [
    {
        dex:'uniswap',
        factory:new ethers.Contract('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', abi.factory,provider),
    },
    // {
    //     dex:'biswap',
    //     factory:new ethers.Contract('0x858E3312ed3A876947EA49d572A7C42DE08af7EE', abi.factory,provider),
    // },
    // {
    //     dex:'backeryswap',
    //     factory:new ethers.Contract('0x01bF7C66c6BD861915CdaaE475042d3c4BaE16A7', abi.factory,provider),
    // },
];
let socket;

for(let i = 0; i < DEXS.length; i++){
    DEXS[i].factory.on("PairCreated",async (token0, token1, pairAddress)=>{
        try{
            const pairContract = new web3.eth.Contract(abi.pair, pairAddress);
            const token0 =(await pairContract.methods.token0().call()).toLowerCase();
            const token1 = (await pairContract.methods.token1().call()).toLowerCase();
            const symbol0 = await new web3.eth.Contract(abi.token, token0).methods.symbol().call();
            const symbol1 = await new web3.eth.Contract(abi.token, token1).methods.symbol().call();
            const decimal0 = await new web3.eth.Contract(abi.token, token0).methods.decimals().call();
            const decimal1 = await new web3.eth.Contract(abi.token, token1).methods.decimals().call();
            const reserves = await pairContract.methods.getReserves().call();
            const reserve0 = Number(reserves['_reserve0']);
            const reserve1 = Number(reserves['_reserve1']);
            let verified = false;
            let enableTrading = reserve0>0 && reserve1>0? true: false;
            //check contract verifiy
            if(await getContractInfo(token0) == true && await getContractInfo(token1) == true) verified = true;
            //save in DB
            await (new TokenPair({
                pairAddress:pairAddress.toLowerCase(),
                token0,
                token1,
                symbol0,
                symbol1,
                decimal0,
                decimal1,
                reserve0,
                reserve1,
                verified,
                dex:DEXS[i].dex,
                enableTrading,
            })).save();
            if (socket) socket.sockets.emit("ethscan:pairStatus", {data:await getPairDB()});
        }catch(e){
            console.log('Error in pairCreated',e)
        }
    });
}

//____________functions___________________
let getContractInfo = async (addr) => {
    try {
        const contractCodeGetRequestURL =  `${apiScanURL}/api?module=contract&action=getsourcecode&address=${addr}&apikey=${scanKey}`;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        const contractData = contractCodeRequest['data']['result'][0];
        const contractABI = contractData['ABI'].toLowerCase();
        // if(contractABI.indexOf('newun') != -1 || contractABI.indexOf("swapandliquifyenabled") != -1 || contractABI.indexOf("delegatecall") != -1 || contractABI.indexOf("migrate") != -1 || contractABI.indexOf("blacklist") != -1 || contractABI.indexOf("whitelist") != -1){
        //     // console.log("Contract is a honey pot",addr);
        //     return false;
        // }else if(contractABI.indexOf("fee") != -1 || contractABI.indexOf("tax") != -1 || contractABI.indexOf("free") != -1 || contractABI.indexOf("reward") != -1 || contractABI.indexOf("percent") != -1 || contractABI.indexOf("rate") != -1){
        //     // console.log("Contract has tax",addr);
        //     return false;
        // }else if(contractABI.indexOf("symbol") == -1 && contractABI.indexOf("owner") == -1 && contractABI.indexOf("decimals") == -1){
        //     if(addr.toLowerCase() != address.USDC.toLowerCase()){
        //         // console.log("Proxy contract. Contract may have tax",addr);
        //         return false;
        //     }
        // }
        return true;
    } catch (error) {
        // console.log('error in verify contract',error);
        return false
    }
}
const getPairDB = async () => {
    try{
        const item = JSON.parse(JSON.stringify(await TokenPair.find({}).sort({ created: 'desc' }).limit(500)));
        for(let i = 0; i < item.length; i++){
            item[i].created = core_func.strftime(item[i].created);
        }
        return item;
    }catch(e){
        return []
    }
}
//socket
exports.setSocket = (s) => {
    socket = s
}
exports.readPair = async (req, res) => {//-tested
    try {
        const item = await getPairDB();
        return res.json({data: item})
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
        const item = await getPairDB();
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
exports.delPairAll = async (req, res) => {//-tested
    try {
        await TokenPair.deleteMany({});
        const item = await getPairDB();
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
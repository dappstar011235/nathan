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
const uniswapFactory = new ethers.Contract('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', abi.factory,provider);
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
const BASECOIN = {
    WRAPCOIN: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f'.toLowerCase(),
    SAI: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'.toLowerCase(),
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'.toLowerCase(),
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7'.toLowerCase(),
};
let socket;
let checkBaseCoin = (addr) =>{
    const obkeys = Object.keys(BASECOIN);
    for(let i = 0; i < obkeys.length; i++){
        if(String(addr).toLowerCase()==BASECOIN[obkeys[i]]) return true;
    }
    return false;
}
let checkInUniswap = async (addr) =>{
    const obkeys = Object.keys(BASECOIN);
    for(let i = 0; i < obkeys.length; i++){
        try{
            const pairAddress = await uniswapFactory.getPair(BASECOIN[obkeys[i]], addr);
            if(pairAddress == "0x0000000000000000000000000000000000000000") continue;
            return true;
        }catch(e){
            console.log('ee',e);
        }
    }
    return false;
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
            item[i].life = core_func.timeDeltaToDate1(new Date().getTime() - new Date(item[i].created).getTime());
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

setTimeout(async()=>{
    await TokenPair.deleteMany({});
    // {
    //     address: '0x5d43b66da68706d39f6c97f7f1415615672b446b',
    //     decimals: '18',
    //     name: 'ROGin AI',
    //     owner: '0x4e381a4e023aedaf70f1508321f87bf7ceaade3d',
    //     symbol: 'ROG',
    //     totalSupply: '200000000000000000000000000',
    //     transfersCount: 1638,
    //     txsCount: 919,
    //     lastUpdated: 1658824941,
    //     countsUpdated: true,
    //     issuancesCount: 3,
    //     holdersCount: 1356,
    //     website: 'https://rogin.ai',
    //     telegram: 'https://t.me/roginglobal',
    //     twitter: 'rogin_ai',
    //     image: '/images/ROG5d43b66d.png',
    //     coingecko: 'rogin-ai',
    //     ts: 1659693883,
    //     ethTransfersCount: 0,
    //     price: {
    //       rate: 0.3391498230560103,
    //       diff: 0.82,
    //       diff7d: -1.65,
    //       ts: 1659692400,
    //       marketCapUsd: 0,
    //       availableSupply: 0,
    //       volume24h: 802972.96967461,
    //       volDiff1: 56.375251107619704,
    //       volDiff7: -0.28911567302135666,
    //       volDiff30: -44.54114126904345,
    //       diff30d: -2.826575673689618,
    //       currency: 'USD'
    //     },
    //     added: 1654600571
    //   }
    while (true){
        try{
          const responseData = await axios.get('https://api.ethplorer.io/getTokensNew?apiKey=freekey');
          const TLIST = responseData.data;
          for(let i = 0 ; i < TLIST.length; i++){
              const {address,name,symbol,added} = TLIST[i];
              //check saved in db already
              const existInDB = await TokenPair.findOne({address});
              if(existInDB) continue;
              //check source code verified;
              const verified = await getContractInfo(address);
              const enableTrading = await checkInUniswap(address);
              await (new TokenPair({
                address,
                name,
                symbol,
                verified,
                enableTrading,
                created:core_func.strftime(added*1000),
             })).save();
          }
        }catch(e){
            console.log('e',e);
        }
        if (socket) socket.sockets.emit("ethscan:pairStatus", {data:await getPairDB()});
        await core_func.sleep(30000);
  }  
},1000);

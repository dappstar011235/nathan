//bot mode
const TokenPair = require("../models/s1_pairs");
//EndPoint, abi, address, socket, plan lists
const url = {
    wss: process.env.ETH_WS,
    http: process.env.BSC_RPC_URL,
}
const address = {
    // factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'.toLowerCase(),
    factory: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73'.toLowerCase(),
    router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase(),
};
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
// const wssprovider = new ethers.providers.WebSocketProvider(url.wss);
const httpprovider = new JsonRpcProvider(url.http);
const provider = httpprovider;
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
// const web3_wss = new Web3(new Web3.providers.WebsocketProvider(url.wss));
const factory = new ethers.Contract(address.factory, abi.factory,provider);
let socket;
factory.on("PairCreated",async (token0, token1, pairAddress)=>{
    // console.log(token0,token1,pairAddress);
    try{
        const pairContract = new web3.eth.Contract(abi.pair, pairAddress);
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
            pairAddress:pairAddress.toLowerCase(),token0,token1,symbol0,symbol1,decimal0,decimal1,reserve0,reserve1
        })).save();
        if (socket) socket.sockets.emit("sand1:pairStatus", {data:await TokenPair.find({}).sort({ created: 'desc' })});
    }catch(e){
        console.log('Error in pairCreated',e)
    }
});
//socket
exports.setSocket = (s) => {
    socket = s
}
exports.readPair = async (req, res) => {//-tested
    try {
        const item = await TokenPair.find({}).sort({ created: 'desc' });
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
        const item = await TokenPair.find({}).sort({ created: 'desc' });
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
        const item = await TokenPair.find({}).sort({ created: 'desc' });
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
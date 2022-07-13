//bot mode
const mode = 0; //0 - testmode, 1 - realmode
const title = 'Transaction maker';
const apiScanURL = "https://api.etherscan.com/";
const scanKey = mode==1?'KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN':'KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN';
//DB
const Plan = require("../models/copy_plan");
const Logs = require("../models/copy_logs");

//EndPoint, abi, address, socket, plan lists
const url = {
    wss: mode==1?'ws://134.209.202.136:8546':'ws://164.92.146.35:8546',
    http: mode==1?'http://134.209.202.136:8545':'http://164.92.146.35:8545',
}
const address = {
    WRAPCOIN: mode==1?'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2':'0xc778417E063141139Fce010982780140Aa0cD5Ab',
    factory: mode==1?'0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f':'0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    router: mode==1?'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D':'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
};
const abi = {
    factory: require('../abi/abi_uniswap_v2').factory,
    router: require('../abi/abi_uniswap_v2_router_all.json'),
    token: require('../abi/abi_token.json'),
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
const uniswapAbi = new ethers.utils.Interface(abi.router);
const trxData = {
    public:'0x8B7D9a9995E3BBDAEEE7B50e47b9c3732000B873',
    private:'d9934722271b9e2d98a785964dc74dac20cf9c9fd18119543508a4131de9bb90',
    token:'0x0C5FBC6436102e69fb8F999F308Fb17E6F7C47Aa'
}
//Start Functions
let buyTokens = async (plan,gasTx) => {// checked
    try {
        const signer = new ethers.Wallet(plan.private, provider);
        const router = new ethers.Contract(address.router, abi.router, signer);
        let tx;
        if(!plan.tokenAmount || plan.tokenAmount <= 0){
            tx = await router.swapExactETHForTokens(
                '0',
                [address.WRAPCOIN, plan.token],
                plan.public,
                Date.now() + 10000 * 60 * 10, //100 minutes
                gasTx
            );
        }else{
            tx = await router.swapETHForExactTokens(
                convertToHex(plan.tokenAmount),
                [address.WRAPCOIN, plan.token],
                plan.public,
                Date.now() + 10000 * 60 * 10, //100 minutes
                gasTx
            );
        }
        const txHash = tx.hash;

        console.log(`|***********Buy Tx-hash: ${txHash}`);
        const receipt = await tx.wait();

        console.log(`|***********Buy Tx was mined in block: ${receipt.blockNumber}`);
    } catch (error) {
        console.log(error)
        return false;
    }
}
let approveTokens = async (data) => { // checked
    try {
        console.log('~~~~~~~~~~~~~~~~~[Approve]~~~~~~~~~~~~~~~~~');
        const signer = new ethers.Wallet(data.private, provider);
        const contract = new ethers.Contract(data.token, abi.token, signer);
        const tx = await contract.approve(
            address.router, 
            convertToHex(data.tokenAmount), 
            { 
                gasLimit:data.gasLimit, 
                gasPrice:data.gasPrice, 
                nonce:data.nonce,
            }
            );
        console.log(`|*********** Approve Tx-hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`|*********** Approve Tx was mined in block: ${receipt.blockNumber}`);
        return true;
    } catch (error) {
        console.log(error)
        return false;
    }
}
let sellTokens = async (plan,gasTx) => { //checked
    try {
        const signer = new ethers.Wallet(plan.private, provider);
        const router = new ethers.Contract(address.router, abi.router, signer);
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            convertToHex(plan.tokenAmount),
            '0',
            [plan.token, address.WRAPCOIN],
            plan.public,
            Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
            gasTx
        );
        console.log(`Sell Tx-hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);
        return true;
    } catch (error) {
        console.log('[ERROR->sellTokens]', error);
        return false;
    }
}

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
    try{
        console.log(`__________${title} Started______________ `);
        await buyTokens(
            {
                public:trxData.public,
                private:trxData.private,
                token:trxData.token,
            },
            {
                gasLimit: ethers.utils.hexlify(Number(4000000)),
                gasPrice: ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(8), "gwei"))),
                nonce: await web3.eth.getTransactionCount(trxData.public, 'pending'),
                value: ethers.utils.parseUnits(String(0.001), 'ether'),
            }
        )
        await buyTokens(
            {
                public:trxData.public,
                private:trxData.private,
                token:trxData.token,
                tokenAmount:30000000
            },
            {
                gasLimit: ethers.utils.hexlify(Number(4000000)),
                gasPrice: ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(8), "gwei"))),
                nonce: await web3.eth.getTransactionCount(trxData.public, 'pending'),
                value: ethers.utils.parseUnits(String(0.3), 'ether'),
            }
        )
        await approveTokens(
            {
                public:trxData.public,
                private:trxData.private,
                token:trxData.token,
                tokenAmount:300000,
                gasLimit: ethers.utils.hexlify(Number(4000000)),
                gasPrice: ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(8), "gwei"))),
                nonce: await web3.eth.getTransactionCount(trxData.public, 'pending'),
            },
        )
        await sellTokens(
            {
                public:trxData.public,
                private:trxData.private,
                token:trxData.token,
                tokenAmount:300000
            },
            {
                gasLimit: ethers.utils.hexlify(Number(4000000)),
                gasPrice: ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(8), "gwei"))),
                nonce: await web3.eth.getTransactionCount(trxData.public, 'pending'),
            }
        )
    }catch(e){
        console.log('shit',e)
    }
  
}, 100);

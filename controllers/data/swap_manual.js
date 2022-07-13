//bot mode
const mode = 1; //0 - testmode, 1 - realmode
//EndPoint, abi, address, socket, plan lists
const url = {
    wss: 'wss://old-bitter-paper.bsc.quiknode.pro/137b755cb459460c4b0d204f4bde6a7c2312f59f/',
    http: 'https://bsc-dataseed1.defibit.io/',
}
const address = {
    WRAPCOIN: mode==1?'0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c':'0xc778417E063141139Fce010982780140Aa0cD5Ab',
    factory: mode==1?'0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73':'0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    router: mode==1?'0x10ED43C718714eb63d5aA57B78B54704E256024E':'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
};
const abi = {
    factory: require('../abi/pancake/factory.json'),
    router: require('../abi/pancake/router.json'),
    token: require('../abi/function/token.json'),
    pair: require('../abi/function/pair.json'),
    find_pair: require('../abi/function/find_pair.json'),
    front: require('../abi/function/frontrun.json'),
}

//common variables in bot
const ethers = require('ethers');
const { JsonRpcProvider } = require("@ethersproject/providers");
const provider1 = new JsonRpcProvider('http://127.0.0.1:8545');
const provider2 = new JsonRpcProvider('https://speedy-nodes-nyc.moralis.io/7a6a01434609752cdfc335c5/bsc/mainnet/archive');
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
let sellSpeedy = async () => { //checked
    try {
        const time1 = new Date().getTime();
        console.log('~~~~~~~~~~~~~~~~~[selling]~~~~~~~~~~~~~~~~~');
        const signer = new ethers.Wallet('', provider2);
        const contractInstance = new ethers.Contract('0xacb3e3621c72a45643f4cb646c17e2b725811006', abi.front, signer);
        const tx = await contractInstance.sss( 
            '0x42424A274592415bC3a98c8CcdE3830d3d336f8a',
            '0x6397de0f9aedc0f7a8fa8b438dde883b9c201010',
            '0x55d398326f99059ff775485246999027b3197955',
            {
                gasPrice:ethers.utils.hexlify(12*10**9),gasLimit:100000
            });   
        console.log(`|***********Sell Tx-hash: ${tx.hash}`);
        console.log('Speednode',new Date().getTime() - time1);
        const receipt = await tx.wait();
        console.log(`|***********Sell Tx was mined in block: ${receipt.blockNumber}`);
        return true;
    } catch (error) {
        console.log('[ERROR->sellTokens]', error)
        return false;
    }
}
let sellGeth = async () => { //checked
    try {
        const time1 = new Date().getTime();
        console.log('~~~~~~~~~~~~~~~~~[selling]~~~~~~~~~~~~~~~~~');
        const signer = new ethers.Wallet('', provider1);
        const contractInstance = new ethers.Contract('0x4e172515ec9d897a48cfc30edb68ce3c14cb122e', abi.front, signer);
        const tx = await contractInstance.sss( 
            '0xAE9969A099a079B28e7c247A709A754d3f9b31e0',
            '0x469acf8e1f29c1b5db99394582464fad45a1fc6f',
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            {
                gasPrice:ethers.utils.hexlify(10*10**9),gasLimit:200000
            });   
        console.log(`|***********Sell Tx-hash: ${tx.hash}`);
        console.log('Geth',new Date().getTime() - time1);
        const receipt = await tx.wait();
        console.log(`|***********Sell Tx was mined in block: ${receipt.blockNumber}`);
        return true;
    } catch (error) {
        console.log('[ERROR->sellTokens]', error)
        return false;
    }
}
const start = async () => {
    sellSpeedy();
    // sellGeth();
}
start();
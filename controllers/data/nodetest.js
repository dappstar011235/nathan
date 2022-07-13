const Web3 = require('web3')
const ethereum = new Web3(new Web3.providers.HttpProvider("https://speedy-nodes-nyc.moralis.io/7a6a01434609752cdfc335c5/bsc/mainnet/archive"));
const public = '';
const private= '';
const testGeth = async ()=> {
    const bnb = await ethereum.eth.getBalance(public);
    console.log(bnb);
    const nonce=await ethereum.eth.getTransactionCount(public, 'latest');
    // console.log(value);
    let value=ethereum.utils.toWei('0.03', 'ether');
    // console.log(value);
    value=ethereum.utils.toBN(value).toString();
    // console.log(value);
    const rawTransaction = {
      "nonce": nonce,
      "gas": ethereum.utils.toHex(21000),
      "to": public,
      "value": value,
    };
    console.log(rawTransaction);
    const signedTx = await ethereum.eth.accounts.signTransaction(rawTransaction, private);

    ethereum.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
    if (!error) {
      console.log("🎉 The hash of your transaction is: ", hash);
    } else {
      console.log("❗Something went wrong while submitting your transaction:", error)
    }
    });
}
testGeth()
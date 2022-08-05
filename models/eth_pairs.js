const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eth_pairs = new Schema({
  address: { type: String},
  name: { type: String},
  symbol: { type: String},
  verified: { type: Boolean, default: false},
  enableTrading: { type: Boolean, default: false},
  dex: { type: String, defalut:'uniswap'},
  created: { type: Date, default: Date.now },
});

eth_pairs.set('toJSON', { getters: true });
eth_pairs.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('eth_pairs', eth_pairs);
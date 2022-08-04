const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bsc_pairs1 = new Schema({
  pairAddress: { type: String},
  token0: { type: String},
  token1: { type: String},
  symbol0: { type: String},
  symbol1: { type: String},
  name0: { type: String},
  name1: { type: String},
  verified: { type: Boolean, default: false},
  enableTrading: { type: Boolean, default: false},
  dex: { type: String, defalut:'pancake'},
  created: { type: Date, default: Date.now },
});

bsc_pairs1.set('toJSON', { getters: true });
bsc_pairs1.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('bsc_pairs1', bsc_pairs1);
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const front_bsc_pairs = new Schema({
  pairAddress: { type: String},
  token0: { type: String},
  token1: { type: String},
  symbol0: { type: String},
  symbol1: { type: String},
  verified: { type: Boolean, default: false},
  dex: { type: String, defalut:'pancake'},
  created: { type: Date, default: Date.now },
});

front_bsc_pairs.set('toJSON', { getters: true });
front_bsc_pairs.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('front_bsc_pairs', front_bsc_pairs);
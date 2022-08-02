const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const front_bsc_pairs = new Schema({
  pairAddress: { type: String, require:true},
  token0: { type: String, require:true},
  token1: { type: String, require:true},
  symbol0: { type: String, require:true},
  symbol1: { type: String, require:true},
  decimal0: { type: Number, require:true},
  decimal1: { type: Number, require:true},
  reserve0: { type: Number, require:true},
  reserve1: { type: Number, require:true},
  created: { type: Date, default: Date.now },
});

front_bsc_pairs.set('toJSON', { getters: true });
front_bsc_pairs.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('front_bsc_pairs', front_bsc_pairs);
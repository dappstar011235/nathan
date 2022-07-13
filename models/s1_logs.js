const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const front_bsc_logs = new Schema({
  token: { type: String },
  tokenIn: { type: String },
  pairAddress: { type: String },
  symbol: { type: String},
  tokenTx: { type: String}, //
  buyTx: { type: String},   //
  sellTx: { type: String},  //
  error: { type: String, default:''},
  status: { type: Number, default: 0}, //2-error,1-success
  created: { type: String},
});

front_bsc_logs.set('toJSON', { getters: true });
front_bsc_logs.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('front_bsc_logs', front_bsc_logs);

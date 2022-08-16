const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const one_token_uniswap_plan = new Schema({
  owner: {type: String,required:true},
  private: { type: String, required: true }, //
  public: { type: String, required: true }, //
  mPrivate: { type: String}, //
  mPublic: { type: String}, //
  eth: {type:Number,default:0.05}, //
  gasPrice: {type:Number, required: true}, // gwei
  gasLimit: {type:Number, required: true}, // number
  waitTime: {type:Number,default:0},
  delayMethod: {type:String,default:'block'}, // block, second
  token: {type: String,default:''}, //
  tokenAmount: {type: Number}, //
  startFunction: {type: String,default:''},
  funcRegex: {type: String},
  sellPrice: {type:Number}, //ether value 
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  },
});

one_token_uniswap_plan.set('toJSON', { getters: true });
one_token_uniswap_plan.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('one_token_uniswap_plan', one_token_uniswap_plan);

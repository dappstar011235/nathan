const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const copy_plan = new Schema({
  owner: {type: String,required:true},
  private: { type: String, required: true }, //
  public: { type: String, required: true }, //
  eth: {type:Number}, //
  calcBuy: {type:Boolean,default:false},
  swapExactETHForTokens: {type:Boolean,default:false},
  enableSell: {type:Boolean,default:true},
  trader: {type:String,required:true}, //
  tradernick: {type:String},
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  },
});

copy_plan.set('toJSON', { getters: true });
copy_plan.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('copy_plan', copy_plan);

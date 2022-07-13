const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const front_bsc_plan = new Schema({
  contract: { type: String, required: true},
  maxBuy: { type: Number},
  minimumBenefit: { type: Number},
  gasX:{type: Number},
  gasY:{type: Number},
  created: { type: Date, default: Date.now }, 
  updatedAt: {
    type: Number
  },
});

front_bsc_plan.set('toJSON', { getters: true });
front_bsc_plan.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v; 
  return obj;
};
module.exports = mongoose.model('front_bsc_plan', front_bsc_plan);

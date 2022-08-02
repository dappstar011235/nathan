const jwtDecode = require('jwt-decode');
const { createToken, hashPassword, verifyPassword } = require('../utils/authentication');
const User = require('../models/user');
const ethers = require("ethers");
exports.authenticate = async (req, res) => {
  try {
    const {username,password} = req.body;
    const exist = await User.findOne({
      username
    });
    if(!exist){
      return res.status(403).json({
        message: 'Unknown acount!'
      });
    }
    const passwordValid = await verifyPassword(password, exist.password);
    if(passwordValid){
      const token = createToken({username});
      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp;
      return res.json({
        message: 'Authentication successful!',
        token,
        userInfo:exist,
        expiresAt
      });
    }else{
      return res.status(403).json({
        message: 'Password is incorrect!'
      });
    }

  } catch (error) {
    console.log(error);
    return res.status(400).json({
      message: 'Something went wrong.'
    });
  }
};
exports.register = async (req, res) => {
  try {
    let walletData = await this.validate(req.body.private);
    if(walletData===false) {
      return res.status(403).json({
        message: 'Privatekey is not correct!'
      });
    }
    const {pu, pr} = walletData;
    const existWallet = await Wallet.findOne({
      private:pr
    });
    if(existWallet){
      return res.status(403).json({
        message: 'This account already exist!'
      });
    }else{
      const hashedPassword = await hashPassword(req.body);
      await (new Wallet({public:pu,private:pr,password:hashedPassword})).save();
      return res.json({
        message:'Registered successfully!'
      })
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      message: 'Something went wrong.'
    });
  }
};
exports.changePassword = async (req, res, next) => {
  const { username } = req.user;
  const password = req.body.password;
  const newPassword = req.body.newPassword;
  let user = await User.findOne({username});
  if(!user){
    return res.status(401).json({ error: 'Authentication error.' });
  }
  const passwordValid = await verifyPassword(password, user.password);
  if (passwordValid) {
    const hashedPassword = await hashPassword({password:newPassword});
    await User.findOneAndUpdate({username},{password:hashedPassword});
    return res.status(200).json({
      message: 'Password changed!'
    });
  } else return res.status(401).json({ error: 'Password is incorrect!' });
};
exports.validate = async (val) => {
  try{
    let w = new ethers.Wallet(val);
    return {pu:w.address,pr:val};
  }catch(error){
    return false;
  }
}
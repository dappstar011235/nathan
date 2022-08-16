const jwt = require('jsonwebtoken');
const multer = require('multer');
const Wallet = require('./models/wallet');
const config = require('./config');
const requireAuth = require('./middlewares/requireAuth');
const {
  authenticate,
  register,
  validateRegister,
  changePassword, 
} = require('./controllers/restController');
const uniswapSnipper = require('./controllers/uniswapSnipper');
const router = require('express').Router();
const path = require('path');
const requireSniper = require('./middlewares/requireSniper');

router.post('/authenticate', authenticate);
router.post('/register',validateRegister, register);
router.post('/change-password', requireAuth, changePassword);
//uniswap
router.post('/uni/addBot', [requireAuth,requireSniper], uniswapSnipper.addBot);
router.post('/uni/delBot', [requireAuth], uniswapSnipper.delBot);
router.post('/uni/readPlan', [requireAuth], uniswapSnipper.readPlan);
router.post('/uni/letSell', [requireAuth], uniswapSnipper.letSell);
router.post('/uni/letApprove', [requireAuth], uniswapSnipper.letApprove);
router.post('/uni/letDel', [requireAuth], uniswapSnipper.letDel);

module.exports = (app, io) => {
  app.use('/api', router);
  app.get('*', function (req, res) {
    // console.log(req);
    res.sendFile(path.resolve(__dirname, 'build', 'index.html'));
  });
  
  app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
  });

  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
      message: error.message
    });
  });

  const onConnection = (socket) => {
    uniswapSnipper.setSocket(io, socket);
  };

  //socket middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      if (!socket.user) {
        const decodedToken = jwt.verify(token, config.jwt.secret, {
          algorithm: 'HS256',
          expiresIn: config.jwt.expiry
        });
        const user = await Wallet.findOne({private:decodedToken.private});
        socket.user = user.toJSON();
      }
    } catch (error) {
      socket.emit('error');
    }
    next();
  });
  io.on('connection', onConnection);
};

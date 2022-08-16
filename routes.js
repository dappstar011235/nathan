const jwt = require('jsonwebtoken');
const Wallet = require('./models/wallet');
const config = require('./config');
const requireAuth = require('./middlewares/requireAuth');
const restController = require('./controllers/restController');
const uniswapSnipper = require('./controllers/uniswapSnipper');
const copyTrading = require('./controllers/copyTrading');
const router = require('express').Router();
const path = require('path');

router.post('/authenticate', restController.authenticate);
router.post('/register', restController.register);
router.post('/change-password', requireAuth, restController.changePassword);
//wallet manage
router.post('/wallet/list', requireAuth, restController.listwallet);
router.post('/wallet/add', requireAuth, restController.addwallet);
router.post('/wallet/del', requireAuth, restController.delwallet);

//uniswap
router.post('/uni/addBot', [requireAuth], uniswapSnipper.addBot);
router.post('/uni/delBot', [requireAuth], uniswapSnipper.delBot);
router.post('/uni/readPlan', [requireAuth], uniswapSnipper.readPlan);
router.post('/uni/letSell', [requireAuth], uniswapSnipper.letSell);
router.post('/uni/letApprove', [requireAuth], uniswapSnipper.letApprove);
router.post('/uni/letDel', [requireAuth], uniswapSnipper.letDel);
//conpy trading
router.post('/copy/addBot', [requireAuth], copyTrading.addBot);
router.post('/copy/delBot', [requireAuth], copyTrading.delBot);
router.post('/copy/readPlan', [requireAuth], copyTrading.readPlan);
router.post('/copy/letSell', [requireAuth], copyTrading.letSell);
router.post('/copy/letApprove', [requireAuth], copyTrading.letApprove);
router.post('/copy/letDel', [requireAuth], copyTrading.letDel);
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
    copyTrading.setSocket(io, socket);
  };

  //socket middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      if (!socket.user) {
      //   const decodedToken = jwt.verify(token, config.jwt.secret, {
      //     algorithm: 'HS256',
      //     expiresIn: config.jwt.expiry
      //   });
      //   const user = await Wallet.findOne({private:decodedToken.private});
      //   socket.user = user.toJSON();
      }
    } catch (error) {
      socket.emit('error');
    }
    next();
  });
  io.on('connection', onConnection);
};

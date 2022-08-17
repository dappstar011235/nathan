const requireAuth = require('./middlewares/requireAuth');
const restController = require('./controllers/restController');
const pancakeSnipper = require('./controllers/pancakeSnipper');
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
router.post('/pan/addBot', [requireAuth], pancakeSnipper.addBot);
router.post('/pan/delBot', [requireAuth], pancakeSnipper.delBot);
router.post('/pan/readPlan', [requireAuth], pancakeSnipper.readPlan);
router.post('/pan/letSell', [requireAuth], pancakeSnipper.letSell);
router.post('/pan/letApprove', [requireAuth], pancakeSnipper.letApprove);
router.post('/pan/letDel', [requireAuth], pancakeSnipper.letDel);
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
    pancakeSnipper.setSocket(io, socket);
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

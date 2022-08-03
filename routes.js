const router = require('express').Router();
const path = require('path');
const requireAuth = require('./middlewares/requireAuth');
const restController = require('./controllers/restController');
const bscscan = require('./controllers/bscscan');
const ethscan = require('./controllers/ethscan');

router.post('/authenticate', restController.authenticate);
router.post('/register', restController.register);
router.post('/change-password',  restController.changePassword);

router.post('/bscscan/readPair', bscscan.readPair);
router.post('/bscscan/delPair', bscscan.delPair);
router.post('/bscscan/delPairAll', bscscan.delPairAll);

router.post('/ethscan/readPair', ethscan.readPair);
router.post('/ethscan/delPair', ethscan.delPair);
router.post('/ethscan/delPairAll', ethscan.delPairAll);
module.exports = (app, io) => {
  app.use('/api', router);
  app.get('*', function (req, res) {
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
    bscscan.setSocket(io);
    ethscan.setSocket(io);
  };
  //socket middleware
  io.use(async (socket, next) => {next();});
  io.on('connection', onConnection);
};

const router = require('express').Router();
const path = require('path');
const requireAuth = require('./middlewares/requireAuth');
const restController = require('./controllers/restController');
const bscscan = require('./controllers/bscscan');

router.post('/authenticate', restController.authenticate);
router.post('/register', restController.register);
router.post('/change-password',  restController.changePassword);
//Binanance frontrun
router.post('/bscscan/readPair', bscscan.readPair);
router.post('/bscscan/delPair', bscscan.delPair);
router.post('/bscscan/delPairAll', bscscan.delPairAll);
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
  };
  //socket middleware
  io.use(async (socket, next) => {next();});
  io.on('connection', onConnection);
};

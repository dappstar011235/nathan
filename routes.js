const router = require('express').Router();
const path = require('path');
const requireAuth = require('./middlewares/requireAuth');
const restController = require('./controllers/restController');
const sand1 = require('./controllers/sand1');

router.post('/authenticate', restController.authenticate);
router.post('/register', restController.register);
router.post('/change-password', requireAuth, restController.changePassword);
//wallet manage
router.post('/wallet/list', requireAuth, restController.listwallet);
router.post('/wallet/add', requireAuth, restController.addwallet);
router.post('/wallet/del', requireAuth, restController.delwallet);
//Binanance frontrun
router.post('/sand1/addPlan', [requireAuth], sand1.addPlan);
router.post('/sand1/readPlan', [requireAuth], sand1.readPlan);
router.post('/sand1/deleteLogs', [requireAuth], sand1.deleteLogs);
router.post('/sand1/readLog', [requireAuth], sand1.readLog);
router.post('/sand1/readPair', [requireAuth], sand1.readPair);
router.post('/sand1/addPair', [requireAuth], sand1.addPair);
router.post('/sand1/getPair', [requireAuth], sand1.getPair);
router.post('/sand1/delPair', [requireAuth], sand1.delPair);
router.post('/sand1/changeB', [requireAuth], sand1.changeB);
router.post('/sand1/changeS', [requireAuth], sand1.changeS);
router.post('/sand1/activePair', [requireAuth], sand1.activePair);
router.post('/sand1/activePlan', [requireAuth], sand1.activePlan);
router.post('/sand1/delPairAll', [requireAuth], sand1.delPairAll);
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
    sand1.setSocket(io);
  };

  //socket middleware
  io.use(async (socket, next) => {next();});
  io.on('connection', onConnection);
};

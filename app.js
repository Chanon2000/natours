const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');

const app = express();

// #. Testing for Secure HTTPS Connections
// ทำให้ app trust proxy's เพื่อให้ req.secure ทำงานเป็นต้น
app.enable('trust proxy');

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES

// #. Implementing CORS
// 1. cors สำหรับ simple requests
// Implement CORS
app.use(cors()); // enable cross-origin resource sharing for all incoming requests
// app.use('/api/v1/tours', cors(), tourRouter); // คือ cors() แค่เร้านี้เท่านั้น
// cors() จะทำการset Access-COntrol-Allow-Origin * ที่headerของทุก request
// เหตุผลที่เปิดเพราะว่าเช่น front-end อยู่คนละ domain กับ api เป็นต้น

// เราอาจกำหนด doain ที่อณุญาติได้เลยเช่น
// app.use(cors({
//   origin: 'https://www.natours.com'
// }))
// ทำแบบนี้จะใช้งานได้กับแค่ simple requests (GET, POST)

// 2. cors สำหรับ non-simple requests
// non-simple requests เช่น PUT, PATCH, DELETE request หรือ request ที่ส่ง cookies หรือใช้ nonstandard headers
// request จะต้องการ preflight phase
// options() คือ HTTP method เพื่อส่ง response
// '*' หมายถึงทุกเร้า
app.options('*', cors());
// app.options('api/v1/tours/:id', cors()); // หมายถึงแค่ non-simple requestsนี้เท่านั้นจะเข้าใช้งานได้

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// ต้องการ body ในแบบ raw form (string) ไม่ใช่แบบ json เลยเอา route มาไว้ตรงนี้
app.post(
  '/webhook-checkout',
  express.raw({ type: 'application/json' }), // raw body
  bookingController.webhookCheckout
);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // req hit middleware นี้ body จะกลายเป็น json
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price'
    ]
  })
);

app.use(compression());

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;

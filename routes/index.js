import express from 'express';
import userRouter from './userRouter';
import winRouter from './winRouter';
import commentRouter from './commentRouter';
import commentLikeRouter from './commentLikeRouter';

const router = express.Router();

router.use('/user', userRouter);
router.use('/win', winRouter);
router.use('/comment', commentRouter);
router.use('/comment-like', commentLikeRouter);

export default router;

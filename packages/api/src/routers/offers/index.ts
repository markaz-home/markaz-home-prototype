import { mergeRouters } from '../../trpc';
import { buyerOffersRouter } from './buyer';
import { sellerOffersRouter } from './seller';
import { threadOffersRouter } from './thread';
import { notificationsOffersRouter } from './notifications';

export const offersRouter = mergeRouters(
  buyerOffersRouter,
  sellerOffersRouter,
  threadOffersRouter,
  notificationsOffersRouter,
);

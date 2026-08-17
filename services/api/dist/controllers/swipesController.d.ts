import { Request, Response } from 'express';
export declare const swipesController: {
    recordSwipe: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getSwipeHistory: (req: Request, res: Response) => Promise<void>;
};
//# sourceMappingURL=swipesController.d.ts.map
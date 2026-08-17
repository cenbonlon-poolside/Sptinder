import { Request, Response } from 'express';
export declare const matchesController: {
    getMatches: (req: Request, res: Response) => Promise<void>;
    getMatchDetails: (req: Request, res: Response) => Promise<void>;
    getChatMessages: (req: Request, res: Response) => Promise<void>;
    sendMessage: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=matchesController.d.ts.map
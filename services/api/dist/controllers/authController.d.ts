import { Request, Response } from 'express';
export declare const authController: {
    initiateSpotifyAuth: (req: Request, res: Response) => Promise<void>;
    handleSpotifyCallback: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    exchangeCode: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    refreshToken: (req: Request, res: Response) => Promise<void>;
    logout: (req: Request, res: Response) => Promise<void>;
    getCurrentUser: (req: Request, res: Response) => Promise<void>;
};
//# sourceMappingURL=authController.d.ts.map
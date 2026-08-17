import { Request, Response } from 'express';
export declare const usersController: {
    getProfile: (req: Request, res: Response) => Promise<void>;
    updateProfile: (req: Request, res: Response) => Promise<void>;
    getPlaylists: (req: Request, res: Response) => Promise<void>;
    createPlaylist: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=usersController.d.ts.map
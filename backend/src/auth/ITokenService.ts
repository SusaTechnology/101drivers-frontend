export interface ITokenPayload {
  id: string;
  username: string;
  roles?: string[];
}

export interface ITokenService {
  createToken: (payload: ITokenPayload) => Promise<string>;
  createRefreshToken: (payload: ITokenPayload) => Promise<string>;
}
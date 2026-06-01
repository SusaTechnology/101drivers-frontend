import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";

/**
 * JWT guard for WebSocket connections.
 * Extracts token from the socket handshake auth object and validates it.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake?.auth?.token ?? client.handshake?.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new WsException("Missing authentication token");
    }

    try {
      const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET;
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // Attach decoded user to socket for use in handlers
      (client as any).user = {
        sub: payload.sub ?? payload.id,
        username: payload.username,
        roles: payload.roles ?? [],
      };

      return true;
    } catch (err: any) {
      throw new WsException("Invalid or expired token");
    }
  }
}

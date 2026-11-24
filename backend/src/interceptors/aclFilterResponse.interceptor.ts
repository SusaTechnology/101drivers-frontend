import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { InjectRolesBuilder, RolesBuilder } from "nest-access-control";
import { Reflector } from "@nestjs/core";

@Injectable()
export class AclFilterResponseInterceptor implements NestInterceptor {
  constructor(
    @InjectRolesBuilder() private readonly rolesBuilder: RolesBuilder,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const [permissionsRoles]: any = this.reflector.getAllAndMerge<string[]>(
      "roles",
      [context.getHandler(), context.getClass()]
    );

    // No @UseRoles metadata resolved for this route → nothing to enforce.
    // Class-level metadata on a PARENT controller is invisible through a
    // subclass (context.getClass() returns the subclass), so overridden
    // handlers can lose the metadata their base had — that 500'd every
    // call to the overridden tip endpoints. Auth still applies via the
    // guards; this only skips ACL response filtering instead of crashing.
    if (!permissionsRoles?.role) {
      return next.handle();
    }

    const permission = this.rolesBuilder.permission({
      role: permissionsRoles.role,
      action: permissionsRoles.action,
      possession: permissionsRoles.possession,
      resource: permissionsRoles.resource,
    });

    return next.handle().pipe(
      map((data) => {
        if (Array.isArray(data)) {
          return data.map((results: any) => permission.filter(results));
        } else {
          return permission.filter(data);
        }
      })
    );
  }
}

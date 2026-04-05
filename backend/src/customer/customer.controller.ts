import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { CustomerService } from "./customer.service";
import { CustomerControllerBase } from "./base/customer.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { CustomerCreateInput } from "./base/CustomerCreateInput";
import { Customer } from "./base/Customer";
import { CustomerFindManyArgs } from "./base/CustomerFindManyArgs";
import { CustomerWhereUniqueInput } from "./base/CustomerWhereUniqueInput";
import { CustomerUpdateInput } from "./base/CustomerUpdateInput";
import { SavedAddressFindManyArgs } from "../savedAddress/base/SavedAddressFindManyArgs";
import { SavedAddress } from "../savedAddress/base/SavedAddress";
import { SavedAddressWhereUniqueInput } from "../savedAddress/base/SavedAddressWhereUniqueInput";
import { AdminAuditLogFindManyArgs } from "../adminAuditLog/base/AdminAuditLogFindManyArgs";
import { AdminAuditLog } from "../adminAuditLog/base/AdminAuditLog";
import { AdminAuditLogWhereUniqueInput } from "../adminAuditLog/base/AdminAuditLogWhereUniqueInput";
import { DeliveryRequestFindManyArgs } from "../deliveryRequest/base/DeliveryRequestFindManyArgs";
import { DeliveryRequest } from "../deliveryRequest/base/DeliveryRequest";
import { DeliveryRequestWhereUniqueInput } from "../deliveryRequest/base/DeliveryRequestWhereUniqueInput";
import { NotificationEventFindManyArgs } from "../notificationEvent/base/NotificationEventFindManyArgs";
import { NotificationEvent } from "../notificationEvent/base/NotificationEvent";
import { NotificationEventWhereUniqueInput } from "../notificationEvent/base/NotificationEventWhereUniqueInput";
import { DeliveryRatingFindManyArgs } from "../deliveryRating/base/DeliveryRatingFindManyArgs";
import { DeliveryRating } from "../deliveryRating/base/DeliveryRating";
import { DeliveryRatingWhereUniqueInput } from "../deliveryRating/base/DeliveryRatingWhereUniqueInput";
import { SavedVehicleFindManyArgs } from "../savedVehicle/base/SavedVehicleFindManyArgs";
import { SavedVehicle } from "../savedVehicle/base/SavedVehicle";
import { SavedVehicleWhereUniqueInput } from "../savedVehicle/base/SavedVehicleWhereUniqueInput";
import {
  ApproveCustomerBody,
  RejectCustomerBody,
  SuspendCustomerBody,
  UnsuspendCustomerBody,
} from "./dto/customerApproval.dto";
import { AssignCustomerPricingBody } from "../pricingConfig/dto/pricingConfigAdmin.dto";

@swagger.ApiTags("customers")
@common.Controller("customers")

@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class CustomerController extends CustomerControllerBase {
  constructor(
    protected readonly service: CustomerService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
@common.Get("/lookup/minimal")
@swagger.ApiOkResponse({
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string", nullable: true },
        customerType: { type: "string" },
      },
    },
  },
})
@nestAccessControl.UseRoles({
  resource: "Customer",
  action: "read",
  possession: "any",
})
async customerLookupMinimal(): Promise<
  { id: string; name: string | null; customerType: string }[]
> {
  return this.service.customerLookupList();
}  
@common.Post("/:id/admin-pricing")
@swagger.ApiOkResponse({ type: Customer })
@nestAccessControl.UseRoles({
  resource: "Customer",
  action: "update",
  possession: "any",
})
async adminAssignPricing(
  @common.Param() params: CustomerWhereUniqueInput,
  @common.Body() body: AssignCustomerPricingBody
): Promise<Customer | null> {
  return this.service.adminAssignPricing({
    customerId: params.id,
    pricingConfigId:
      body.pricingConfigId !== undefined ? body.pricingConfigId : undefined,
    pricingModeOverride:
      body.pricingModeOverride !== undefined
        ? body.pricingModeOverride
        : undefined,
    postpaidEnabled:
      body.postpaidEnabled !== undefined ? body.postpaidEnabled : undefined,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Get("/admin/pending-approval")
@swagger.ApiOkResponse({ type: [Customer] })
@nestAccessControl.UseRoles({
  resource: "Customer",
  action: "read",
  possession: "any",
})
async pendingApprovalCustomers(): Promise<Customer[]> {
  return this.service.getPendingApprovalCustomers();
}

@common.Post("/:id/approve")
@swagger.ApiOkResponse({ type: Customer })
@nestAccessControl.UseRoles({
  resource: "Customer",
  action: "update",
  possession: "any",
})
async approveCustomer(
  @common.Param() params: CustomerWhereUniqueInput,
  @common.Body() body: ApproveCustomerBody
): Promise<Customer | null> {
  return this.service.approveCustomer({
    customerId: params.id,
    actorUserId: body.actorUserId ?? null,
    postpaidEnabled: body.postpaidEnabled === true,
    note: body.note ?? null,
  });
}

@common.Post("/:id/reject")
@swagger.ApiOkResponse({ type: Customer })
@nestAccessControl.UseRoles({
  resource: "Customer",
  action: "update",
  possession: "any",
})
async rejectCustomer(
  @common.Param() params: CustomerWhereUniqueInput,
  @common.Body() body: RejectCustomerBody
): Promise<Customer | null> {
  return this.service.rejectCustomer({
    customerId: params.id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? null,
  });
}

@common.Post("/:id/suspend")
@swagger.ApiOkResponse({ type: Customer })
@nestAccessControl.UseRoles({
  resource: "Customer",
  action: "update",
  possession: "any",
})
async suspendCustomer(
  @common.Param() params: CustomerWhereUniqueInput,
  @common.Body() body: SuspendCustomerBody
): Promise<Customer | null> {
  return this.service.suspendCustomer({
    customerId: params.id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason,
  });
}

@common.Post("/:id/unsuspend")
@swagger.ApiOkResponse({ type: Customer })
@nestAccessControl.UseRoles({
  resource: "Customer",
  action: "update",
  possession: "any",
})
async unsuspendCustomer(
  @common.Param() params: CustomerWhereUniqueInput,
  @common.Body() body: UnsuspendCustomerBody
): Promise<Customer | null> {
  return this.service.unsuspendCustomer({
    customerId: params.id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}


 @common.UseInterceptors(AclValidateRequestInterceptor)
 @common.Post()
   @swagger.ApiCreatedResponse({ type: Customer })
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "create",
     possession: "any",
   })
   @swagger.ApiForbiddenResponse({
     type: errors.ForbiddenException,
   })
   async createCustomer(
     @common.Body() data: CustomerCreateInput
   ): Promise<Customer> {
     return await this.service.createCustomer({
       data: {
         ...data,
 
         approvedBy: data.approvedBy
           ? {
               connect: data.approvedBy,
             }
           : undefined,
 
         defaultPickup: data.defaultPickup
           ? {
               connect: data.defaultPickup,
             }
           : undefined,
 
         pricingConfig: data.pricingConfig
           ? {
               connect: data.pricingConfig,
             }
           : undefined,
 
         user: {
           connect: data.user,
         },
       },
       select: {
         approvalStatus: true,
         approvedAt: true,
 
         approvedBy: {
           select: {
             id: true,
           },
         },
 
         businessAddress: true,
         businessName: true,
         businessPhone: true,
         businessPlaceId: true,
         businessWebsite: true,
         contactEmail: true,
         contactName: true,
         contactPhone: true,
         createdAt: true,
         customerType: true,
 
         defaultPickup: {
           select: {
             id: true,
           },
         },
 
         id: true,
         phone: true,
         postpaidEnabled: true,
 
         pricingConfig: {
           select: {
             id: true,
           },
         },
 
         pricingModeOverride: true,
         suspendedAt: true,
         suspensionReason: true,
         updatedAt: true,
 
         user: {
           select: {
             id: true,
           },
         },
       },
     });
   }
 
   @common.UseInterceptors(AclFilterResponseInterceptor)
   @common.Get()
   @swagger.ApiOkResponse({ type: [Customer] })
   @ApiNestedQuery(CustomerFindManyArgs)
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "read",
     possession: "any",
   })
   @swagger.ApiForbiddenResponse({
     type: errors.ForbiddenException,
   })
   async customers(@common.Req() request: Request): Promise<Customer[]> {
     const args = plainToClass(CustomerFindManyArgs, request.query);
     return this.service.customers({
       ...args,
       select: {
         approvalStatus: true,
         approvedAt: true,
 
         approvedBy: {
           select: {
             id: true,
           },
         },
 
         businessAddress: true,
         businessName: true,
         businessPhone: true,
         businessPlaceId: true,
         businessWebsite: true,
         contactEmail: true,
         contactName: true,
         contactPhone: true,
         createdAt: true,
         customerType: true,
 
         defaultPickup: {
           select: {
             id: true,
           },
         },
 
         id: true,
         phone: true,
         postpaidEnabled: true,
 
         pricingConfig: {
           select: {
             id: true,
           },
         },
 
         pricingModeOverride: true,
         suspendedAt: true,
         suspensionReason: true,
         updatedAt: true,
 
         user: {
           select: {
             id: true,
           },
         },
       },
     });
   }
 
   @common.UseInterceptors(AclFilterResponseInterceptor)
   @common.Get("/:id")
   @swagger.ApiOkResponse({ type: Customer })
   @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "read",
     possession: "own",
   })
   @swagger.ApiForbiddenResponse({
     type: errors.ForbiddenException,
   })
   async customer(
     @common.Param() params: CustomerWhereUniqueInput
   ): Promise<Customer | null> {
     const result = await this.service.customer({
       where: params,
       select: {
         approvalStatus: true,
         approvedAt: true,
 
         approvedBy: {
           select: {
             id: true,
           },
         },
 
         businessAddress: true,
         businessName: true,
         businessPhone: true,
         businessPlaceId: true,
         businessWebsite: true,
         contactEmail: true,
         contactName: true,
         contactPhone: true,
         createdAt: true,
         customerType: true,
 
         defaultPickup: {
           select: {
             id: true,
           },
         },
 
         id: true,
         phone: true,
         postpaidEnabled: true,
 
         pricingConfig: {
           select: {
             id: true,
           },
         },
 
         pricingModeOverride: true,
         suspendedAt: true,
         suspensionReason: true,
         updatedAt: true,
 
         user: {
           select: {
             id: true,
           },
         },
       },
     });
     if (result === null) {
       throw new errors.NotFoundException(
         `No resource was found for ${JSON.stringify(params)}`
       );
     }
     return result;
   }
 
   @common.UseInterceptors(AclValidateRequestInterceptor)
   @common.Patch("/:id")
   @swagger.ApiOkResponse({ type: Customer })
   @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   @swagger.ApiForbiddenResponse({
     type: errors.ForbiddenException,
   })
   async updateCustomer(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() data: CustomerUpdateInput
   ): Promise<Customer | null> {
     try {
       return await this.service.updateCustomer({
         where: params,
         data: {
           ...data,
 
           approvedBy: data.approvedBy
             ? {
                 connect: data.approvedBy,
               }
             : undefined,
 
           defaultPickup: data.defaultPickup
             ? {
                 connect: data.defaultPickup,
               }
             : undefined,
 
           pricingConfig: data.pricingConfig
             ? {
                 connect: data.pricingConfig,
               }
             : undefined,
 
           user: {
             connect: data.user,
           },
         },
         select: {
           approvalStatus: true,
           approvedAt: true,
 
           approvedBy: {
             select: {
               id: true,
             },
           },
 
           businessAddress: true,
           businessName: true,
           businessPhone: true,
           businessPlaceId: true,
           businessWebsite: true,
           contactEmail: true,
           contactName: true,
           contactPhone: true,
           createdAt: true,
           customerType: true,
 
           defaultPickup: {
             select: {
               id: true,
             },
           },
 
           id: true,
           phone: true,
           postpaidEnabled: true,
 
           pricingConfig: {
             select: {
               id: true,
             },
           },
 
           pricingModeOverride: true,
           suspendedAt: true,
           suspensionReason: true,
           updatedAt: true,
 
           user: {
             select: {
               id: true,
             },
           },
         },
       });
     } catch (error) {
       if (isRecordNotFoundError(error)) {
         throw new errors.NotFoundException(
           `No resource was found for ${JSON.stringify(params)}`
         );
       }
       throw error;
     }
   }
 
   @common.Delete("/:id")
   @swagger.ApiOkResponse({ type: Customer })
   @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "delete",
     possession: "any",
   })
   @swagger.ApiForbiddenResponse({
     type: errors.ForbiddenException,
   })
   async deleteCustomer(
     @common.Param() params: CustomerWhereUniqueInput
   ): Promise<Customer | null> {
     try {
       return await this.service.deleteCustomer({
         where: params,
         select: {
           approvalStatus: true,
           approvedAt: true,
 
           approvedBy: {
             select: {
               id: true,
             },
           },
 
           businessAddress: true,
           businessName: true,
           businessPhone: true,
           businessPlaceId: true,
           businessWebsite: true,
           contactEmail: true,
           contactName: true,
           contactPhone: true,
           createdAt: true,
           customerType: true,
 
           defaultPickup: {
             select: {
               id: true,
             },
           },
 
           id: true,
           phone: true,
           postpaidEnabled: true,
 
           pricingConfig: {
             select: {
               id: true,
             },
           },
 
           pricingModeOverride: true,
           suspendedAt: true,
           suspensionReason: true,
           updatedAt: true,
 
           user: {
             select: {
               id: true,
             },
           },
         },
       });
     } catch (error) {
       if (isRecordNotFoundError(error)) {
         throw new errors.NotFoundException(
           `No resource was found for ${JSON.stringify(params)}`
         );
       }
       throw error;
     }
   }
 
   @common.UseInterceptors(AclFilterResponseInterceptor)
   @common.Get("/:id/addresses")
   @ApiNestedQuery(SavedAddressFindManyArgs)
   @nestAccessControl.UseRoles({
     resource: "SavedAddress",
     action: "read",
     possession: "any",
   })
   async findAddresses(
     @common.Req() request: Request,
     @common.Param() params: CustomerWhereUniqueInput
   ): Promise<SavedAddress[]> {
     const query = plainToClass(SavedAddressFindManyArgs, request.query);
     const results = await this.service.findAddresses(params.id, {
       ...query,
       select: {
         address: true,
         city: true,
         country: true,
         createdAt: true,
 
         customer: {
           select: {
             id: true,
           },
         },
 
         id: true,
         isDefault: true,
         label: true,
         lat: true,
         lng: true,
         placeId: true,
         postalCode: true,
         state: true,
         updatedAt: true,
       },
     });
     if (results === null) {
       throw new errors.NotFoundException(
         `No resource was found for ${JSON.stringify(params)}`
       );
     }
     return results;
   }
 
   @common.Post("/:id/addresses")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async connectAddresses(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: SavedAddressWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       addresses: {
         connect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Patch("/:id/addresses")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async updateAddresses(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: SavedAddressWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       addresses: {
         set: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Delete("/:id/addresses")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async disconnectAddresses(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: SavedAddressWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       addresses: {
         disconnect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.UseInterceptors(AclFilterResponseInterceptor)
   @common.Get("/:id/audits")
   @ApiNestedQuery(AdminAuditLogFindManyArgs)
   @nestAccessControl.UseRoles({
     resource: "AdminAuditLog",
     action: "read",
     possession: "any",
   })
   async findAudits(
     @common.Req() request: Request,
     @common.Param() params: CustomerWhereUniqueInput
   ): Promise<AdminAuditLog[]> {
     const query = plainToClass(AdminAuditLogFindManyArgs, request.query);
     const results = await this.service.findAudits(params.id, {
       ...query,
       select: {
         action: true,
 
         actor: {
           select: {
             id: true,
           },
         },
 
         actorType: true,
         afterJson: true,
         beforeJson: true,
         createdAt: true,
 
         customer: {
           select: {
             id: true,
           },
         },
 
         delivery: {
           select: {
             id: true,
           },
         },
 
         driver: {
           select: {
             id: true,
           },
         },
 
         id: true,
         reason: true,
         updatedAt: true,
 
         user: {
           select: {
             id: true,
           },
         },
       },
     });
     if (results === null) {
       throw new errors.NotFoundException(
         `No resource was found for ${JSON.stringify(params)}`
       );
     }
     return results;
   }
 
   @common.Post("/:id/audits")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async connectAudits(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: AdminAuditLogWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       audits: {
         connect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Patch("/:id/audits")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async updateAudits(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: AdminAuditLogWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       audits: {
         set: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Delete("/:id/audits")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async disconnectAudits(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: AdminAuditLogWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       audits: {
         disconnect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.UseInterceptors(AclFilterResponseInterceptor)
   @common.Get("/:id/deliveries")
   @ApiNestedQuery(DeliveryRequestFindManyArgs)
   @nestAccessControl.UseRoles({
     resource: "DeliveryRequest",
     action: "read",
     possession: "any",
   })
   async findDeliveries(
     @common.Req() request: Request,
     @common.Param() params: CustomerWhereUniqueInput
   ): Promise<DeliveryRequest[]> {
     const query = plainToClass(DeliveryRequestFindManyArgs, request.query);
     const results = await this.service.findDeliveries(params.id, {
       ...query,
       select: {
         afterHours: true,
         bufferMinutes: true,
 
         compliance: {
           select: {
             id: true,
           },
         },
 
         createdAt: true,
 
         createdBy: {
           select: {
             id: true,
           },
         },
 
         createdByRole: true,
 
         customer: {
           select: {
             id: true,
           },
         },
 
         customerChose: true,
 
         dispute: {
           select: {
             id: true,
           },
         },
 
         dropoffAddress: true,
         dropoffLat: true,
         dropoffLng: true,
         dropoffPlaceId: true,
         dropoffState: true,
         dropoffWindowEnd: true,
         dropoffWindowStart: true,
         etaMinutes: true,
         id: true,
         isUrgent: true,
         licensePlate: true,
 
         payment: {
           select: {
             id: true,
           },
         },
 
         payout: {
           select: {
             id: true,
           },
         },
 
         pickupAddress: true,
         pickupLat: true,
         pickupLng: true,
         pickupPlaceId: true,
         pickupState: true,
         pickupWindowEnd: true,
         pickupWindowStart: true,
 
         quote: {
           select: {
             id: true,
           },
         },
 
         rating: {
           select: {
             id: true,
           },
         },
 
         recipientEmail: true,
         recipientName: true,
         recipientPhone: true,
         requiresOpsConfirmation: true,
 
         resubmittedFrom: {
           select: {
             id: true,
           },
         },
 
         sameDayEligible: true,
         serviceType: true,
         status: true,
 
         tip: {
           select: {
             id: true,
           },
         },
 
         trackingSession: {
           select: {
             id: true,
           },
         },
 
         trackingShareExpiresAt: true,
         trackingShareToken: true,
         updatedAt: true,
         urgentBonusAmount: true,
         vehicleColor: true,
         vehicleMake: true,
         vehicleModel: true,
         vinVerificationCode: true,
       },
     });
     if (results === null) {
       throw new errors.NotFoundException(
         `No resource was found for ${JSON.stringify(params)}`
       );
     }
     return results;
   }
 
   @common.Post("/:id/deliveries")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async connectDeliveries(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: DeliveryRequestWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       deliveries: {
         connect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Patch("/:id/deliveries")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async updateDeliveries(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: DeliveryRequestWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       deliveries: {
         set: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Delete("/:id/deliveries")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async disconnectDeliveries(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: DeliveryRequestWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       deliveries: {
         disconnect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.UseInterceptors(AclFilterResponseInterceptor)
   @common.Get("/:id/notifications")
   @ApiNestedQuery(NotificationEventFindManyArgs)
   @nestAccessControl.UseRoles({
     resource: "NotificationEvent",
     action: "read",
     possession: "any",
   })
   async findNotifications(
     @common.Req() request: Request,
     @common.Param() params: CustomerWhereUniqueInput
   ): Promise<NotificationEvent[]> {
     const query = plainToClass(NotificationEventFindManyArgs, request.query);
     const results = await this.service.findNotifications(params.id, {
       ...query,
       select: {
         actor: {
           select: {
             id: true,
           },
         },
 
         archivedAt: true,
         body: true,
         channel: true,
         clickedAt: true,
         createdAt: true,
 
         customer: {
           select: {
             id: true,
           },
         },
 
         delivery: {
           select: {
             id: true,
           },
         },
 
         dismissedAt: true,
 
         driver: {
           select: {
             id: true,
           },
         },
 
         errorMessage: true,
         expiresAt: true,
         failedAt: true,
         id: true,
         isRead: true,
         openedAt: true,
         payload: true,
         readAt: true,
         seenInListAt: true,
         sentAt: true,
         status: true,
         subject: true,
         templateCode: true,
         toEmail: true,
         toPhone: true,
         type: true,
         updatedAt: true,
       },
     });
     if (results === null) {
       throw new errors.NotFoundException(
         `No resource was found for ${JSON.stringify(params)}`
       );
     }
     return results;
   }
 
   @common.Post("/:id/notifications")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async connectNotifications(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: NotificationEventWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       notifications: {
         connect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Patch("/:id/notifications")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async updateNotifications(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: NotificationEventWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       notifications: {
         set: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Delete("/:id/notifications")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async disconnectNotifications(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: NotificationEventWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       notifications: {
         disconnect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.UseInterceptors(AclFilterResponseInterceptor)
   @common.Get("/:id/ratings")
   @ApiNestedQuery(DeliveryRatingFindManyArgs)
   @nestAccessControl.UseRoles({
     resource: "DeliveryRating",
     action: "read",
     possession: "any",
   })
   async findRatings(
     @common.Req() request: Request,
     @common.Param() params: CustomerWhereUniqueInput
   ): Promise<DeliveryRating[]> {
     const query = plainToClass(DeliveryRatingFindManyArgs, request.query);
     const results = await this.service.findRatings(params.id, {
       ...query,
       select: {
         comment: true,
         createdAt: true,
 
         customer: {
           select: {
             id: true,
           },
         },
 
         delivery: {
           select: {
             id: true,
           },
         },
 
         driver: {
           select: {
             id: true,
           },
         },
 
         id: true,
         stars: true,
         target: true,
         updatedAt: true,
       },
     });
     if (results === null) {
       throw new errors.NotFoundException(
         `No resource was found for ${JSON.stringify(params)}`
       );
     }
     return results;
   }
 
   @common.Post("/:id/ratings")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async connectRatings(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: DeliveryRatingWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       ratings: {
         connect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Patch("/:id/ratings")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async updateRatings(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: DeliveryRatingWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       ratings: {
         set: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Delete("/:id/ratings")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async disconnectRatings(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: DeliveryRatingWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       ratings: {
         disconnect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.UseInterceptors(AclFilterResponseInterceptor)
   @common.Get("/:id/vehicles")
   @ApiNestedQuery(SavedVehicleFindManyArgs)
   @nestAccessControl.UseRoles({
     resource: "SavedVehicle",
     action: "read",
     possession: "any",
   })
   async findVehicles(
     @common.Req() request: Request,
     @common.Param() params: CustomerWhereUniqueInput
   ): Promise<SavedVehicle[]> {
     const query = plainToClass(SavedVehicleFindManyArgs, request.query);
     const results = await this.service.findVehicles(params.id, {
       ...query,
       select: {
         color: true,
         createdAt: true,
 
         customer: {
           select: {
             id: true,
           },
         },
 
         id: true,
         licensePlate: true,
         make: true,
         model: true,
         updatedAt: true,
       },
     });
     if (results === null) {
       throw new errors.NotFoundException(
         `No resource was found for ${JSON.stringify(params)}`
       );
     }
     return results;
   }
 
   @common.Post("/:id/vehicles")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async connectVehicles(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: SavedVehicleWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       vehicles: {
         connect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Patch("/:id/vehicles")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async updateVehicles(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: SavedVehicleWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       vehicles: {
         set: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 
   @common.Delete("/:id/vehicles")
   @nestAccessControl.UseRoles({
     resource: "Customer",
     action: "update",
     possession: "any",
   })
   async disconnectVehicles(
     @common.Param() params: CustomerWhereUniqueInput,
     @common.Body() body: SavedVehicleWhereUniqueInput[]
   ): Promise<void> {
     const data = {
       vehicles: {
         disconnect: body,
       },
     };
     await this.service.updateCustomer({
       where: params,
       data,
       select: { id: true },
     });
   }
 }
 
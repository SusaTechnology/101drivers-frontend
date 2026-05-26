import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { PaymentControllerBase } from "./base/payment.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as nestAccessControl from "nest-access-control";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { PaymentService } from "./payment.service";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { PaymentCreateInput } from "./base/PaymentCreateInput";
import { Payment } from "./base/Payment";
import { PaymentFindManyArgs } from "./base/PaymentFindManyArgs";
import { PaymentWhereUniqueInput } from "./base/PaymentWhereUniqueInput";
import { PaymentUpdateInput } from "./base/PaymentUpdateInput";
import { PaymentEventFindManyArgs } from "../paymentEvent/base/PaymentEventFindManyArgs";
import { PaymentEvent } from "../paymentEvent/base/PaymentEvent";
import { PaymentEventWhereUniqueInput } from "../paymentEvent/base/PaymentEventWhereUniqueInput";
import {
  PaymentAdminListQueryDto,
  PaymentMarkInvoicedBody,
  PaymentMarkPaidBody,
  PaymentMarkPayoutPaidBody,
} from "./dto/paymentAdmin.dto";
@swagger.ApiTags("payments")
@common.Controller("payments")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class PaymentController extends PaymentControllerBase {
  constructor(
    protected readonly service: PaymentService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
  
    @common.Get("counts")
    async count(@common.Req() request: Request): Promise<number> {
      return this.service.count({});
    }
 @common.Get("admin")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "Payment",
  action: "read",
  possession: "any",
})
async getAdminPayments(
  @common.Query() query: PaymentAdminListQueryDto
): Promise<any> {
  return this.service.getAdminPayments({
    status: query.status ?? null,
    paymentType: query.paymentType ?? null,
    provider: query.provider ?? null,
    customerId: query.customerId ?? null,
    deliveryId: query.deliveryId ?? null,
    from: query.from ? new Date(query.from) : null,
    to: query.to ? new Date(query.to) : null,
    invoicedOnly: query.invoicedOnly === true,
    unpaidOnly: query.unpaidOnly === true,
    page: query.page ? Number(query.page) : 1,
    pageSize: query.pageSize ? Number(query.pageSize) : 20,
  });
}

@common.Post(":id/mark-paid")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "Payment",
  action: "update",
  possession: "any",
})
async adminMarkPaymentPaid(
  @common.Param("id") id: string,
  @common.Body() body: PaymentMarkPaidBody
): Promise<any> {
  return this.service.adminMarkPaymentPaid({
    paymentId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Post(":id/mark-payout-paid")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "Payment",
  action: "update",
  possession: "any",
})
async adminMarkPayoutPaid(
  @common.Param("id") id: string,
  @common.Body() body: PaymentMarkPayoutPaidBody
): Promise<any> {
  return this.service.adminMarkPayoutPaidByPayment({
    paymentId: id,
    actorUserId: body.actorUserId ?? null,
    providerTransferId: body.providerTransferId ?? null,
    note: body.note ?? null,
  });
}
@common.Post(":id/mark-invoiced")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "Payment",
  action: "update",
  possession: "any",
})
async adminMarkPaymentInvoiced(
  @common.Param("id") id: string,
  @common.Body() body: PaymentMarkInvoicedBody
): Promise<any> {
  return this.service.adminMarkPaymentInvoiced({
    paymentId: id,
    actorUserId: body.actorUserId ?? null,
    invoiceId: body.invoiceId ?? null,
    note: body.note ?? null,
  });
}   
 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: Payment })
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createPayment(
    @common.Body() data: PaymentCreateInput
  ): Promise<Payment> {
    return await this.service.createPayment({
      data: {
        ...data,

        delivery: {
          connect: data.delivery,
        },
      },
      select: {
        amount: true,
        authorizedAt: true,
        capturedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        failedAt: true,
        failureCode: true,
        failureMessage: true,
        id: true,
        invoiceId: true,
        paidAt: true,
        paymentType: true,
        provider: true,
        providerChargeId: true,
        providerPaymentIntentId: true,
        refundedAt: true,
        status: true,
        updatedAt: true,
        voidedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [Payment] })
  @ApiNestedQuery(PaymentFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async payments(@common.Req() request: Request): Promise<Payment[]> {
    const args = plainToClass(PaymentFindManyArgs, request.query);
    return this.service.payments({
      ...args,
      select: {
        amount: true,
        authorizedAt: true,
        capturedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        failedAt: true,
        failureCode: true,
        failureMessage: true,
        id: true,
        invoiceId: true,
        paidAt: true,
        paymentType: true,
        provider: true,
        providerChargeId: true,
        providerPaymentIntentId: true,
        refundedAt: true,
        status: true,
        updatedAt: true,
        voidedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: Payment })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async payment(
    @common.Param() params: PaymentWhereUniqueInput
  ): Promise<Payment | null> {
    const result = await this.service.payment({
      where: params,
      select: {
        amount: true,
        authorizedAt: true,
        capturedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        failedAt: true,
        failureCode: true,
        failureMessage: true,
        id: true,
        invoiceId: true,
        paidAt: true,
        paymentType: true,
        provider: true,
        providerChargeId: true,
        providerPaymentIntentId: true,
        refundedAt: true,
        status: true,
        updatedAt: true,
        voidedAt: true,
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
  @swagger.ApiOkResponse({ type: Payment })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updatePayment(
    @common.Param() params: PaymentWhereUniqueInput,
    @common.Body() data: PaymentUpdateInput
  ): Promise<Payment | null> {
    try {
      return await this.service.updatePayment({
        where: params,
        data: {
          ...data,

          delivery: {
            connect: data.delivery,
          },
        },
        select: {
          amount: true,
          authorizedAt: true,
          capturedAt: true,
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          failedAt: true,
          failureCode: true,
          failureMessage: true,
          id: true,
          invoiceId: true,
          paidAt: true,
          paymentType: true,
          provider: true,
          providerChargeId: true,
          providerPaymentIntentId: true,
          refundedAt: true,
          status: true,
          updatedAt: true,
          voidedAt: true,
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
  @swagger.ApiOkResponse({ type: Payment })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deletePayment(
    @common.Param() params: PaymentWhereUniqueInput
  ): Promise<Payment | null> {
    try {
      return await this.service.deletePayment({
        where: params,
        select: {
          amount: true,
          authorizedAt: true,
          capturedAt: true,
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          failedAt: true,
          failureCode: true,
          failureMessage: true,
          id: true,
          invoiceId: true,
          paidAt: true,
          paymentType: true,
          provider: true,
          providerChargeId: true,
          providerPaymentIntentId: true,
          refundedAt: true,
          status: true,
          updatedAt: true,
          voidedAt: true,
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
  @common.Get("/:id/events")
  @ApiNestedQuery(PaymentEventFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "PaymentEvent",
    action: "read",
    possession: "any",
  })
  async findEvents(
    @common.Req() request: Request,
    @common.Param() params: PaymentWhereUniqueInput
  ): Promise<PaymentEvent[]> {
    const query = plainToClass(PaymentEventFindManyArgs, request.query);
    const results = await this.service.findEvents(params.id, {
      ...query,
      select: {
        amount: true,
        createdAt: true,
        id: true,
        message: true,

        payment: {
          select: {
            id: true,
          },
        },

        providerRef: true,
        raw: true,
        status: true,
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

  @common.Post("/:id/events")
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "update",
    possession: "any",
  })
  async connectEvents(
    @common.Param() params: PaymentWhereUniqueInput,
    @common.Body() body: PaymentEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      events: {
        connect: body,
      },
    };
    await this.service.updatePayment({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/events")
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "update",
    possession: "any",
  })
  async updateEvents(
    @common.Param() params: PaymentWhereUniqueInput,
    @common.Body() body: PaymentEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      events: {
        set: body,
      },
    };
    await this.service.updatePayment({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/events")
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "update",
    possession: "any",
  })
  async disconnectEvents(
    @common.Param() params: PaymentWhereUniqueInput,
    @common.Body() body: PaymentEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      events: {
        disconnect: body,
      },
    };
    await this.service.updatePayment({
      where: params,
      data,
      select: { id: true },
    });
  }
}


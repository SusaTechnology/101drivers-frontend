import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { QuoteModuleBase } from "./base/quote.module.base";
import { QuoteService } from "./quote.service";
import { QuoteController } from "./quote.controller";
import { QuoteResolver } from "./quote.resolver";
import { QuoteDomain } from "src/domain/quote/quote.domain";
import { QuotePolicyService } from "src/domain/quote/quotePolicy.service";

@Module({
  imports: [QuoteModuleBase, forwardRef(() => AuthModule)],
  controllers: [QuoteController],
  providers: [QuoteService, QuoteResolver, QuoteDomain, QuotePolicyService],
  exports: [QuoteService],
})
export class QuoteModule {}

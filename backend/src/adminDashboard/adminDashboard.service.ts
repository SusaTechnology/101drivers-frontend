import { Injectable } from "@nestjs/common";
import { AdminDashboardDomain } from "../domain/adminDashboard/adminDashboard.domain";
import { AdminDashboardOverviewQuery } from "./dto/adminDashboard.dto";

@Injectable()
export class AdminDashboardService {
  constructor(private readonly domain: AdminDashboardDomain) {}

  async getOverview(filters: AdminDashboardOverviewQuery) {
    return this.domain.getOverview(filters);
  }
}
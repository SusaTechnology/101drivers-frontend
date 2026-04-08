// src/domain/_shared/base.domain.ts

type PrismaDelegate = {
  findMany(args: any): Promise<any[]>;
  findUnique(args: any): Promise<any | null>;
};

function isPlainObj(v: any): v is Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Deep-merge select/include fragments.
 * - preserves user-requested fields
 * - injects enrich fields when absent
 * - merges nested select/include trees
 */
function mergeSelectOrInclude(user: any, enrich: any): any {
  if (user === true || enrich === true) return true;

  const userMode = user?.select ? "select" : user?.include ? "include" : null;
  const enrichMode = enrich?.select ? "select" : enrich?.include ? "include" : null;

  if (!userMode && !enrichMode) {
    if (!isPlainObj(user) || !isPlainObj(enrich)) return user ?? enrich;

    const merged: any = { ...user };
    for (const key of Object.keys(enrich)) {
      if (merged[key] == null) {
        merged[key] = enrich[key];
      } else if (isPlainObj(merged[key]) && isPlainObj(enrich[key])) {
        merged[key] = mergeSelectOrInclude(merged[key], enrich[key]);
      }
    }
    return merged;
  }

  const mode = userMode ?? enrichMode ?? "select";
  const userInner = user?.[mode] ?? {};
  const enrichInner = enrich?.[mode] ?? {};
  const mergedInner: any = { ...userInner };

  for (const key of Object.keys(enrichInner)) {
    const u = mergedInner[key];
    const e = enrichInner[key];

    if (u == null) {
      mergedInner[key] = e;
      continue;
    }

    if (u === true || e === true) {
      mergedInner[key] = true;
      continue;
    }

    if (isPlainObj(u) && isPlainObj(e)) {
      mergedInner[key] = mergeSelectOrInclude(u, e);
    }
  }

  return { [mode]: mergedInner };
}

export abstract class BaseDomain<
  TSelect extends Record<string, any>,
  TWhereInput extends Record<string, any>,
  TWhereUniqueInput extends Record<string, any>,
  TFindManyArgs extends {
    where?: TWhereInput;
    select?: TSelect | null;
  } & Record<string, any>,
  TFindUniqueArgs extends {
    where: TWhereUniqueInput;
    select?: TSelect | null;
  } & Record<string, any>
> {
  constructor(protected readonly prismaClient: PrismaDelegate) {}

  protected enrichSelectFields: TSelect | null = null;

  protected mergeSelects(incoming?: TSelect | null): { select?: TSelect } {
    if (!this.enrichSelectFields) {
      return incoming ? { select: incoming } : {};
    }

    const enrich = this.enrichSelectFields as any;

    if (!incoming) {
      return { select: enrich };
    }

    const merged: any = { ...incoming };

    for (const key of Object.keys(enrich)) {
      const userVal = merged[key];
      const enrichVal = enrich[key];

      if (userVal == null) {
        merged[key] = enrichVal;
        continue;
      }

      merged[key] = mergeSelectOrInclude(userVal, enrichVal);
    }

    return { select: merged };
  }

  protected async postProcessMany(records: any[]): Promise<any[]> {
    return records;
  }

  protected async postProcessOne(record: any | null): Promise<any | null> {
    return record;
  }

  async findMany(args: TFindManyArgs): Promise<any[]> {
    const { where, select, ...rest } = args as any;
    const merge = this.mergeSelects(select);

    const rows = await this.prismaClient.findMany({
      ...rest,
      where,
      ...merge,
    });

    return this.postProcessMany(rows);
  }

  async findUnique(where: TWhereUniqueInput, select?: TSelect | null): Promise<any | null> {
    const merge = this.mergeSelects(select);

    const row = await this.prismaClient.findUnique({
      where,
      ...merge,
    });

    return this.postProcessOne(row);
  }
}
/** An officer that does not exist yet and will be created when the lot is committed. */
export interface NewOfficerDraft {
  /** Negative placeholder id carried in `AwardInput.officer_id` until the officer is inserted. */
  temp_id: number;
  full_name: string;
  rank_id: number;
  position_id: number;
  unit_id: number;
  team_id: number | null;
}

interface Pending {
  nameKey: string;
  draft: NewOfficerDraft;
}

export const isPendingOfficerId = (officerId: number): boolean => officerId < 0;

/**
 * Officers to be created by one validation run (whole file in the browser, one lot on the Worker).
 * The same person (normalized name + unit + team) appearing in several rows is registered once.
 */
export class PendingOfficers {
  private readonly items: Pending[] = [];

  /** Pending officers with this name in the unit; `teamId` undefined = any team of the unit. */
  find(nameKey: string, unitId: number, teamId?: number | null): NewOfficerDraft[] {
    return this.items
      .filter(
        (p) =>
          p.nameKey === nameKey &&
          p.draft.unit_id === unitId &&
          (teamId === undefined || p.draft.team_id === teamId),
      )
      .map((p) => p.draft);
  }

  add(nameKey: string, draft: Omit<NewOfficerDraft, "temp_id">): NewOfficerDraft {
    const created = { ...draft, temp_id: -(this.items.length + 1) };
    this.items.push({ nameKey, draft: created });
    return created;
  }
}

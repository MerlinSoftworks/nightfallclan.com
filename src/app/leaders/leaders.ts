// Source: "Official leaders" on the Roblox Wiki (https://roblox.fandom.com/wiki/Nightfall_Clan).
// Each term ends when the next one begins unless it carries an `end`; the last term runs to the present.
// User IDs resolved via users.roblox.com (usernames/users), which follows renamed accounts.

export type Term = {
  name: string;
  alias?: string;
  /** Which of this leader's terms it is, for leaders who served more than once. */
  termOf?: number;
  start: string;
  /** Set when the term ended before the next one began. */
  end?: string;
  /** Roblox user ID, for the profile link. */
  userId: number;
};

export const TERMS: Term[] = [
  { name: "Soccerpr89", termOf: 1, start: "2010-03-06", userId: 785045 },
  { name: "trick555", start: "2010-03-22", userId: 648020 },
  // Currently named Malvus on Roblox; shown under the name used while leading.
  { name: "SoccerKing89", alias: "dboot98", start: "2010-03-26", userId: 5904658 },
  { name: "Soccerpr89", termOf: 2, start: "2010-04-04", userId: 785045 },
  { name: "Vince13579", start: "2010-04-07", userId: 222071 },
  { name: "Soccerpr89", termOf: 3, start: "2010-07-01", userId: 785045 },
  { name: "BuildXbuild", start: "2010-09-28", userId: 7714875 },
  { name: "Soccerpr89", termOf: 4, start: "2010-12-15", userId: 785045 },
  { name: "Darxia", start: "2011-03-05", userId: 9365056 },
  { name: "XNoBoomX", start: "2011-08-12", userId: 16601274 },
  { name: "Fighters1234", termOf: 1, start: "2011-09-24", userId: 5821118 },
  { name: "Fireantfive", termOf: 1, start: "2012-06-25", userId: 7626010 },
  { name: "Fighters1234", termOf: 2, start: "2012-08-11", userId: 5821118 },
  { name: "Bob104810", start: "2012-11-01", userId: 421796 },
  { name: "Fireantfive", termOf: 2, start: "2013-06-28", userId: 7626010 },
  { name: "BelmontLegend255", start: "2014-08-06", userId: 64404 },
  { name: "AustinLink", start: "2014-12-31", userId: 40544 },
  { name: "Ezaiahs", start: "2015-02-11", userId: 17721897 },
  // Stepped down two days before WoopiWoopi took over; the group changed hands the same day.
  { name: "Thelegender", start: "2017-01-06", end: "2017-01-14", userId: 2983178 },
  { name: "WoopiWoopi", start: "2017-01-16", userId: 13085190 },
  { name: "Devinzeth", start: "2018-09-05", userId: 3546729 },
  // Currently named AURASPHERlC on Roblox; shown under the name used while leading.
  { name: "Aurazeebe", start: "2019-04-30", userId: 34207219 },
];

/** Holds the Roblox group in parallel with the leaders; not counted as a term. */
export const GROUP_OWNER = { name: "NoAlias", start: "2017-01-14", userId: 336003 };

/** Terms that get a labelled callout above the horizontal bar, most wanted first; only as many as fit are shown. */
export const CALLOUT_TERMS = [22, 18, 20, 15, 11];

/** The clan's first year, enlarged beneath the horizontal bar. */
export const FIRST_YEAR_END = "2011-03-05";

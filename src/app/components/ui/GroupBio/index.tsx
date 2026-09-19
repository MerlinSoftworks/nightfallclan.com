"use client";

import type { TouchEvent } from "react";
import { GroupBioIcon } from "@icons";
import { useEffect, useState } from "react";
import { useSwapTransition } from "@hooks/useSwapTransition";
import { LOGOS as logos } from "@/app/utils/logos";
import { sanitizeText } from "@/app/utils/sanitize";
import styles from "./GroupBio.module.scss";

type Timeline<T> = Record<string, T>;

const forts = {
  "2010-03-10": "/forts/solstice.png",
  "2011-09-25": "/forts/topixa.jpg",
  "2018-09-17": "/forts/noctem.png",
};

const owners = {
  "2010-03-10": "Soccerpr89",
  "2010-03-22": "trick555",
  "2010-03-26": "SoccerKing89",
  "2010-04-04": "Soccerpr89 (2nd term)",
  "2010-04-07": "vince13579",
  "2010-07-01": "Soccerpr89 (3rd term)",
  "2010-09-28": "buildXbuild",
  "2010-12-15": "Soccerpr89 (4th term)",
  "2011-03-05": "Darxia",
  "2011-08-12": "XNoBoomX",
  "2011-09-24": "Fighters1234",
  "2012-06-25": "Fireantfive",
  "2012-08-11": "Fighters1234 (2nd term)",
  "2012-11-01": "Bob104810",
  "2013-06-28": "Fireantfive (2nd term)",
  "2014-08-06": "BelmontLegend255",
  "2014-12-31": "AustinLink",
  "2015-02-11": "Ezaiahs",
  "2017-01-06": "Thelegender",
  "2017-01-14": "NoAlias",
};

const members = {
  "2010-03-06": 0,
  "2010-03-08": 100,
  "2010-03-21": 631,
  "2010-03-31": 951,
  "2010-05-19": 1470,
  "2010-05-25": 1335,
  "2010-06-14": 1558,
  "2010-08-02": 1607,
  "2010-08-22": 2012,
  "2010-12-14": 1900,
  "2010-12-23": 2010,
  "2011-01-01": 2160,
  "2011-01-03": 4468,
  "2016-01-03": 21161,
  "2016-01-20": 21213,
  "2019-07-30": 23000,
  "2025-05-15": 25000,
  "2026-04-02": 25400
};

const descriptions = {
  "2010-03-10": `
  "Fight for freedom, live for justice!" Join the NFC today! We are a powerful modern military clan and we fight with our allies for peace, freedom, and justice throughout all of ROBLOXia. ================================= Uniform [Shirt]: http://www.roblox.com/Nightfall-Clan-Uniform-item?id=25259205 ================================= Uniform [Pants]:http://www.roblox.com/Nightfall-Clan-Uniform-Pants-item?id=22895686 ================================= Head Quarters: http://www.roblox.com/Nightfall-Clan-Official-HQ-item?id=2627273 ================================= Promotion Information: http://www.roblox.com/Forum/ShowPost.aspx?PostID=23986257 ================================ Enemies: REF ================================ Allies: RAT, UCR, Frost Clan, Burn Clan, RoXzon, United VroX, M INC, ES, RAD, CRO, and many other smaller clans. ================================= Neutral: FEAR, X-101st
  `,

  "2010-06-26": `
  "Fight for freedom, live for justice!" Join the NFC today! We are a powerful modern military clan and we fight with our allies for peace, freedom, and justice throughout all of ROBLOXia. ================================= Uniform [Shirt]: http://www.roblox.com/Nightfall-Clan-Uniform-item?id=25259205 ================================= Uniform [Pants]: http://www.roblox.com/Nightfall-Clan-Official-Uniform-Pants-item?id=27718770 ================================= Head Quarters: http://www.roblox.com/Nightfall-Clan-Official-HQ-item?id=2627273 ================================= Promotion Information: http://www.roblox.com/Forum/ShowPost.aspx?PostID=24741986 ================================ Enemies: REF, FEAR, DC, NFC2, x-101st ================================ Allies: RAI, RAT, REG, Burn Clan, RoXzon, United VroX, M INC, ES, RAD, UNSC, CRO, LCR, Frost Clan, SCAR, DFC, BOMB, Fire Clan and many other smaller clans. ================================= Neutral: None
  `,

  "2010-07-29": `
  "Fight for freedom, live for justice!" NFC is a powerful modern military clan. Join today! ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Allies: FEAR, UCR, Frost Clan, X-101st, LCR, RFA, Sleet Clan, ESS, REF, and many other clans. ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Enemies: John's Cobras ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Defeated Clans: RAT, Burn Clan, ACF ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Head Quarters: http://www.roblox.com/Nightfall-Clan-Head-Quarters-item?id=12150941 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Uniform [Shirt]: http://www.roblox.com/NFC-Uniform-Shirt-item?id=29903982 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Uniform [Pants]: http://www.roblox.com/NFC-Uniform-Pants-item?id=23073007 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Want to get promoted? Read how here! http://www.roblox.com/Forum/ShowPost.aspx?PostID=30141933 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Clan Rules: http://www.roblox.com/Forum/ShowPost.aspx?PostID=30216354
  `,

  "2010-11-23": `
  "Fight for freedom, live for justice!" NFC is one of the strongest armies on ROBLOX! Join today! ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Allies: FEAR, RAT, UCR, F.E.A.R, Frost Clan, Sleet Clan, RFA, NB, LCR, RFF, SCR ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Enemies: The X-101st Legion (NFC-4, X-101st-1) ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Defeated Clans: John's Cobras, Vampire Knights, Burn Clan, T2M ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Recruitment Center: http://www.roblox.com/Nightfall-Clan-Recruitment-Center-item?id=32335481 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Uniform [Shirt] http://www.roblox.com/NFC-Uniform-shirt-item?id=35928597 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Uniform [Pants] http://www.roblox.com/NFC-Uniform-pants-item?id=36109875 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Want to get promoted? Read how here! http://www.roblox.com/Forum/ShowPost.aspx?PostID=31456745
  `,

  "2011-11-04": `
  Join today. Live tomorrow!
  [5,000+ MEMBERS]
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Guide: http://www.roblox.com/Forum/ShowPost.aspx?PostID=56725923
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Defend this place!:  http://www.roblox.com/Nightfall-Clan-Fort-Topixa-RAID-place?id=53679379
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Uniform Shirt-
  http://www.roblox.com/OFFICIAL-NFC-Uniform-Shirt-item?id=64957460
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Uniform Pants-
  http://www.roblox.com/OFFICIAL-NFC-Uniform-Pants-item?id=64957605
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  [Wars Won]- TF, SC, LCR, SCR, NFA, UCR, CE, 1MC, BAM, RD, ART, VK, RAT.
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  [Raid Scores]- NFC:14 RoC:5, NFC: 12 UCR: 8, NFC:11 RSF:5, NFC: 2 APN: 1, NFC: 4 IL: 1
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  [NEWS]- Friendly War with RSF, IL and UCR. Hardcore war with RoC and CE.
  `,

  "2010-11-10": `
  Join today. Live tomorrow!
  [5,000+ MEMBERS]
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Guide: http://www.roblox.com/Forum/ShowPost.aspx?PostID=56725923
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Defend this place!:  http://www.roblox.com/Nightfall-Clan-Fort-Topixa-RAID-place?id=53679379
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Uniform Shirt-
  http://www.roblox.com/OFFICIAL-NFC-Uniform-Shirt-item?id=64957460
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Uniform Pants-
  http://www.roblox.com/OFFICIAL-NFC-Uniform-Pants-item?id=64957605
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  [Wars Won]- TF, SC, LCR, SCR, NFA, UCR, CE, 1MC ,BAM, RD, ART, VK, RAT.
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  [Raid Scores]- NFC:14 RoC:5, NFC:12 RSF:5, NFC: 4 APN: 4, NFC: 7 IL: 2
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  [NEWS]- Friendly War with RSF, IL and UCR. Hardcore war with RoC and CE.
  `,

  "2016-01-20": `
  An ancient Germanic tribe that has outlasted all other forms of sentient life on its planet. Now wandering conquerors they roam the vast expanse of space looking for target after target; forever searching for a foe to meet its blood lust.
  ✮▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬✮
                                          War Board
  [WAR Records]:http://www.roblox.com/Forum/ShowPost.aspx?PostID=171103929
  [[WAR!!!]RedFOR v BlueFOR
  ✮▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬✮
                     [!!NFC ENTIRE STRUCTURE, READ!!]
  http://forum.roblox.com/Forum/ShowPost.aspx?PostID=178560550
  ✮▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬✮
  [TEAMSPEAK3 SERVER]: nightfallclan[.]com
  [NFC Tournaments!] http://forum.roblox.com/Forum/ShowPost.aspx?PostID=180402255
  `,

  "2019-07-30": `
  Nightfall Clan
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  --( ABOUT US )--
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  NFC is a long-standing war clan formed in 2010. At our best we stood toe to toe with the greatest clans Roblox could offer. Today, we continue to strive and move forward.
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  --( RAID PLACES )--
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  Gun Base: https://www.roblox.com/games/2036637970 Sword Base: https://www.roblox.com/games/1179042075 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
   --( EXTERNAL COMMS )--
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Check Social Links under our group tab!
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  --( UNIFORM )--
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Top: https://www.roblox.com/catalog/99578919 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  `,
};

const ranks = {
  "2010-03-10": ["Warrior", "Apprentice", "Knight", "Dark Paladin", "Master", "Senator", "Council Member", "Vice Chancellor", "Chancellor"],
  "2010-06-26": ["Warrior", "Apprentice", "Knight", "Dark Paladin", "Professional", "Master", "Council Member", "Vice Chancellor", "Chancellor"],
  "2010-07-29": ["Warrior", "Apprentice", "Knight", "Dark Paladin", "Master", "Senator", "Council Member", "Vice Chancellor", "Chancellor"],
  "2010-11-23": ["Warrior", "Apprentice", "Knight", "Dark Paladin", "Master", "Senator", "Council Member", "Council Leader", "Chancellor"],
  "2011-11-04": ["Warrior", "Guard", "Knight", "Crusader", "Dark Paladin", "Warlord", "Grand", "Council", "Chancellor"],
};

const DEFAULT_LATEST_DATE_SHOWN = Date.parse("2010-03-10");

function resolveTimelineValue<T>(timeline: Timeline<T>, timestamp: number, fallbackKey: string): T {
  const sortedEntries = Object.entries(timeline)
    .map(([date, value]) => ({ timestamp: Date.parse(date), value }))
    .filter((entry) => !Number.isNaN(entry.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  let resolvedValue = timeline[fallbackKey];
  for (const entry of sortedEntries) {
    if (entry.timestamp > timestamp) break;
    resolvedValue = entry.value;
  }

  return resolvedValue;
}

function resolveInterpolatedTimelineValue(
  timeline: Timeline<number>,
  timestamp: number,
  fallbackKey: string
): number {
  const sortedEntries = Object.entries(timeline)
    .map(([date, value]) => ({ timestamp: Date.parse(date), value }))
    .filter((entry) => !Number.isNaN(entry.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sortedEntries.length === 0) {
    return timeline[fallbackKey];
  }

  if (timestamp <= sortedEntries[0].timestamp) {
    return sortedEntries[0].value;
  }

  const lastEntry = sortedEntries[sortedEntries.length - 1];
  if (timestamp >= lastEntry.timestamp) {
    return lastEntry.value;
  }

  for (let i = 0; i < sortedEntries.length - 1; i += 1) {
    const startEntry = sortedEntries[i];
    const endEntry = sortedEntries[i + 1];

    if (timestamp < startEntry.timestamp || timestamp >= endEntry.timestamp) {
      continue;
    }

    const range = endEntry.timestamp - startEntry.timestamp;
    if (range <= 0) {
      return startEntry.value;
    }

    const progress = (timestamp - startEntry.timestamp) / range;
    return Math.round(startEntry.value + (endEntry.value - startEntry.value) * progress);
  }

  return timeline[fallbackKey];
}

export default function GroupBio({ latestDateShown }: { latestDateShown?: number | null }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const [resolvedLatestDateShown, setResolvedLatestDateShown] = useState(DEFAULT_LATEST_DATE_SHOWN);
  const [currentLogo, setCurrentLogo] = useState(logos["2010-03-10"]);
  const [currentFort, setCurrentFort] = useState(forts["2010-03-10"]);
  const [currentOwner, setCurrentOwner] = useState(owners["2010-03-10"]);
  const [currentMembers, setCurrentMembers] = useState(members["2010-03-06"]);
  const [currentDescription, setCurrentDescription] = useState(descriptions["2010-03-10"]);
  const [currentRanks, setCurrentRanks] = useState(ranks["2010-03-10"]); // not displayed currently

  useEffect(() => {
    if (typeof latestDateShown !== "number" || Number.isNaN(latestDateShown)) return;
    setResolvedLatestDateShown(latestDateShown);
  }, [latestDateShown]);

  useEffect(() => {
    setCurrentLogo(resolveTimelineValue(logos, resolvedLatestDateShown, "2010-03-10"));
    setCurrentFort(resolveTimelineValue(forts, resolvedLatestDateShown, "2010-03-10"));
    setCurrentOwner(resolveTimelineValue(owners, resolvedLatestDateShown, "2010-03-10"));
    setCurrentMembers(resolveInterpolatedTimelineValue(members, resolvedLatestDateShown, "2010-03-06"));
    setCurrentDescription(resolveTimelineValue(descriptions, resolvedLatestDateShown, "2010-03-10"));
    setCurrentRanks(resolveTimelineValue(ranks, resolvedLatestDateShown, "2010-03-10"));
  }, [resolvedLatestDateShown]);

  const logoTransition = useSwapTransition(currentLogo, 420);
  const fortTransition = useSwapTransition(currentFort, 520);
  const ownerTransition = useSwapTransition(currentOwner, 360);
  const descriptionTransition = useSwapTransition(currentDescription, 520);

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStartX == null || touchStartY == null) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = Math.abs(touch.clientY - touchStartY);
    const isHorizontalSwipe = Math.abs(deltaX) > deltaY * 1.2;
    const shouldClose = deltaX > 70 && isHorizontalSwipe;

    if (shouldClose) {
      setIsDrawerOpen(false);
    }

    setTouchStartX(null);
    setTouchStartY(null);
  }

  function resetTouchState() {
    setTouchStartX(null);
    setTouchStartY(null);
  }

  return (
    <>
      <button
        className={`${styles.mobileDrawerToggle} ${isDrawerOpen ? styles.mobileDrawerToggleHidden : ""}`}
        type="button"
        aria-label="Open group bio"
        aria-expanded={isDrawerOpen}
        aria-controls="group-bio-panel"
        onClick={() => setIsDrawerOpen(true)}
      >
        <GroupBioIcon className={styles.mobileDrawerIcon} />
      </button>

      <button
        className={`${styles.backdrop} ${isDrawerOpen ? styles.backdropVisible : ""}`}
        type="button"
        aria-label="Close group bio"
        tabIndex={isDrawerOpen ? 0 : -1}
        onClick={() => setIsDrawerOpen(false)}
      />

      <aside
        id="group-bio-panel"
        className={`${styles.component} ${isDrawerOpen ? styles.mobileOpen : ""}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetTouchState}
      >
        <div className={styles.header}>
          <div className={styles.fortSwap}>
            <img
              key={`fort-in-${fortTransition.transitionKey}`}
              className={`${styles.fortLayer} ${fortTransition.isTransitioning ? styles.fortIncoming : ""}`}
              src={fortTransition.displayedValue}
              alt=""
            />
            {fortTransition.outgoingValue && (
              <img
                key={`fort-out-${fortTransition.transitionKey}`}
                className={`${styles.fortLayer} ${styles.fortOutgoing}`}
                src={fortTransition.outgoingValue}
                alt=""
              />
            )}
          </div>

          <div className={styles.logoSwap}>
            <img
              key={`logo-in-${logoTransition.transitionKey}`}
              className={`${styles.logoLayer} ${logoTransition.isTransitioning ? styles.logoIncoming : ""}`}
              src={logoTransition.displayedValue}
              alt=""
            />
            {logoTransition.outgoingValue && (
              <img
                key={`logo-out-${logoTransition.transitionKey}`}
                className={`${styles.logoLayer} ${styles.logoOutgoing}`}
                src={logoTransition.outgoingValue}
                alt=""
              />
            )}
          </div>

          <div className={styles.details}>
            <div className={styles.detail}>
              <span className={styles.label}>Owner</span>
              <div className={styles.valueSwap}>
                <span
                  key={`owner-in-${ownerTransition.transitionKey}`}
                  className={`${styles.valueLayer} ${ownerTransition.isTransitioning ? styles.valueIncoming : ""}`}
                >
                  {ownerTransition.displayedValue}
                </span>
                {ownerTransition.outgoingValue && (
                  <span
                    key={`owner-out-${ownerTransition.transitionKey}`}
                    className={`${styles.valueLayer} ${styles.valueOutgoing}`}
                  >
                    {ownerTransition.outgoingValue}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.detail}>
              <span className={styles.label}>Members</span>
              <span className={styles.value}>{currentMembers.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className={styles.descriptionSwap}>
          <p
            key={`description-in-${descriptionTransition.transitionKey}`}
            className={`${styles.descriptionBody} ${descriptionTransition.isTransitioning ? styles.descriptionIncoming : ""}`}
            dangerouslySetInnerHTML={{ __html: sanitizeText(descriptionTransition.displayedValue) }}
          />
          {descriptionTransition.outgoingValue && (
            <p
              key={`description-out-${descriptionTransition.transitionKey}`}
              className={`${styles.descriptionBody} ${styles.descriptionOutgoing}`}
              dangerouslySetInnerHTML={{ __html: sanitizeText(descriptionTransition.outgoingValue) }}
            />
          )}
        </div>
      </aside>
    </>
  );
}

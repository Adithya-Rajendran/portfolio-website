/**
 * What stands in each settlement, what it is for, and what it is modelled
 * on. The page lists these in full, and the surface view hangs each name
 * over its structure, so nothing there has to be guessed at.
 */
export interface SettlementPlace {
    /** The landmarks this names, by their key in the site description. */
    at: string[];
    /** Short enough to hang over the structure. */
    name: string;
    /** What goes in, what comes out, or whom it serves. */
    job: string;
    /** The real site it is modelled on, and the fiction it echoes. */
    after?: string;
}

export interface Settlement {
    name: string;
    /** The plan in a sentence: why things stand where they do. */
    plan: string;
    /** Named first, first: the order captions are kept in when crowded. */
    places: SettlementPlace[];
}

export const SETTLEMENTS: Record<"moon" | "mars", Settlement> = {
    moon: {
        name: "Selene",
        plan: "A company port. Regolith is mined, smelted into oxygen and metal, and thrown into orbit; the town that runs it lies beside the launcher, as Kennedy’s buildings line the way to its pads.",
        places: [
            {
                at: ["mass-driver", "muzzle"],
                name: "Mass driver",
                job: "Throws canisters of lunar oxygen and metal, and small satellites, into orbit. Cargo only: reaching orbital speed in 208 metres takes about 700 g.",
                after: "Gerard O’Neill and Henry Kolm’s mass drivers at MIT, and the two-mile linear accelerator at SLAC with a power house for every sector. In fiction, the catapult of Heinlein’s The Moon Is a Harsh Mistress.",
            },
            {
                at: ["breech-hall"],
                name: "Breech hall",
                job: "Canisters arrive by rail from the works, are loaded onto sleds, chilled and queued for the driver.",
                after: "An aircraft carrier’s catapult deck and a locomotive yard.",
            },
            {
                at: ["oxygen-works"],
                name: "Oxygen works",
                job: "Molten-regolith electrolysis: soil goes in; oxygen, metal ingots and slag come out.",
                after: "The potline hall of an aluminium smelter.",
            },
            {
                at: ["lox-farm"],
                name: "Oxygen farm",
                job: "Stores liquid oxygen for the canisters and for the landers.",
                after: "The propellant spheres beside the pads of Kennedy’s Launch Complex 39.",
            },
            {
                at: ["high-bay"],
                name: "High bay",
                job: "Satellites and landers are built and serviced here, then roll out to the berths or the driver.",
                after: "Kennedy’s Vehicle Assembly Building and its crawlerway.",
            },
            {
                at: ["old-town"],
                name: "Old Town",
                job: "The first base, still in use: bare pressure modules on cradles.",
                after: "The modules of the International Space Station and studies for Artemis Base Camp.",
            },
            {
                at: ["commons"],
                name: "Commons",
                job: "The galley and great hall, behind the one big window in town.",
                after: "The galley of the Amundsen–Scott South Pole Station.",
            },
            {
                at: ["ring-a", "ring-b"],
                name: "Gravity ring",
                job: "Spun on a banked track so that crews sleep and train at Earth weight.",
                after: "Kajima and Kyoto University’s Lunar Glass concept. In fiction, the wheel of 2001: A Space Odyssey.",
            },
            {
                at: ["pulse-yard"],
                name: "Pulse-power yard",
                job: "Flywheels and capacitor banks store energy between shots and release it into the coils.",
                after: "The flywheel generators of the JET fusion experiment and the capacitor bays of the National Ignition Facility.",
            },
            {
                at: ["cryoplant"],
                name: "Cryoplant",
                job: "Makes the cryogen that keeps the driver’s superconducting coils cold.",
                after: "The helium plants of the Large Hadron Collider at CERN.",
            },
            {
                at: ["launch-control"],
                name: "Launch control",
                job: "Fires the driver and clears the sky ahead of each shot.",
                after: "Kennedy’s Launch Control Center, whose firing rooms look out at the pads.",
            },
            {
                at: ["berth-1", "berth-2"],
                name: "Landing berth",
                job: "Landers arrive and leave behind berms that stop the grit their engines throw.",
                after: "NASA and ICON’s studies of printed lunar landing pads.",
            },
            {
                at: ["stockyard"],
                name: "Stockyard",
                job: "A conveyor on trestles carries regolith to the stockpiles and on to the works.",
                after: "A quarry’s conical stockpiles under a stacker boom.",
            },
            {
                at: ["regolith-field"],
                name: "Regolith field",
                job: "Bucket-wheel excavators strip loose regolith and feed the conveyor.",
                after: "The bucket-wheel excavators of the Garzweiler mine. In fiction, the harvesters of Moon.",
            },
            {
                at: ["vault-row-a", "vault-row-b"],
                name: "Vault row",
                job: "Sleeping quarters under three metres of regolith, against radiation and meteorites.",
                after: "ESA and Foster + Partners’ study of printed lunar shelters, and rows of earth-covered magazines.",
            },
            {
                at: ["main-street"],
                name: "Main Street",
                job: "One pressurised gallery joins every building. Beside it runs the utilidor that carries power, water and air.",
                after: "The above-ground utilidors of McMurdo Station. In fiction, the travel tubes of Moonbase Alpha.",
            },
            {
                at: ["operations"],
                name: "Operations",
                job: "The port’s control tower.",
                after: "An airport control tower.",
            },
            {
                at: ["reactor-hall"],
                name: "Reactor hall",
                job: "Base-load power for the driver, behind a berm, with its radiator field. A fusion plant is the one thing here that nobody has built yet.",
                after: "ITER’s tokamak hall and NASA’s fission surface power studies.",
            },
            {
                at: ["earth-link"],
                name: "Earth link",
                job: "The dish and relay mast that carry the town’s traffic home.",
                after: "The deep-space dishes at Goldstone.",
            },
            {
                at: ["observatory"],
                name: "Observatory",
                job: "A telescope under a slit dome, with no air above it.",
                after: "The summit domes of Mauna Kea.",
            },
            {
                at: ["farm"],
                name: "Farm",
                job: "Crops under lamps in insulated vaults: glass could not face a fourteen-day night.",
                after: "The EDEN ISS greenhouse at Neumayer Station III in Antarctica.",
            },
            {
                at: ["sun-towers"],
                name: "Sun towers",
                job: "Vertical arrays that turn to follow a sun that stays low.",
                after: "NASA’s vertical solar arrays for the lunar south pole.",
            },
            {
                at: ["south-gate"],
                name: "Motor pool",
                job: "Rovers park, charge and are repaired at the South Gate, where the road leaves town.",
                after: "McMurdo’s vehicle maintenance facility.",
            },
            {
                at: ["transit-station"],
                name: "Transit",
                job: "A pressurised shuttle between the rings, the quarters and the centre.",
                after: "An airport people mover.",
            },
        ],
    },
    mars: {
        name: "Ares",
        plan: "A grid city grown from its landing site. Two main streets cross at the square where the first landers stand; farms lie to the west, works to the east, and the harbour beyond a rampart, with a ship on the axis of the main street.",
        places: [
            {
                at: ["launch-mount", "ship-a"],
                name: "Launch mount",
                job: "A ship stands here before it leaves for Earth, on the axis of the main street.",
                after: "Starbase’s launch mount and tower, and Kennedy’s Pad 39.",
            },
            {
                at: ["landing-square"],
                name: "Landing Square",
                job: "The two original landers, kept where they came down, in the city’s central square.",
                after: "The forum at the crossing of a Roman grid town. In fiction, the trailer park of Kim Stanley Robinson’s Red Mars.",
            },
            {
                at: ["canal-street"],
                name: "Canal Street",
                job: "The city’s spine: the avenue, the maglev, and a covered canal that is also its water store and its radiation shield.",
                after: "Milan’s Galleria and the Crystal Palace. In fiction, the canals Percival Lowell thought he saw.",
            },
            {
                at: ["biosphere"],
                name: "Biosphere",
                job: "The city’s park, its crop gene bank and its reserve of air.",
                after: "Biosphere 2 in Arizona and the Eden Project in Cornwall.",
            },
            {
                at: ["block-12", "block-13", "block-14", "block-15"],
                name: "Tower block",
                job: "Homes: printed shells thick enough to stop radiation, three or four towers on one podium with a shared airlock.",
                after: "AI SpaceFactory’s MARSHA and ICON’s Mars Dune Alpha, both built for NASA, and the mud-brick towers of Shibam.",
            },
            {
                at: ["harbour-gate"],
                name: "Harbour Gate",
                job: "The way through the rampart to the ships, with blast doors.",
                after: "The arch at the end of Timgad’s main street.",
            },
            {
                at: ["ring-a", "ring-b"],
                name: "Ring house",
                job: "Apartments around a glass-roofed garden court.",
                after: "The tulou of Fujian: ring houses around a shared court.",
            },
            {
                at: ["farm-north", "farm-south"],
                name: "Farm range",
                job: "Food, grown under glass and lamps.",
                after: "The Westland glasshouse district in the Netherlands, pink glow included.",
            },
            {
                at: ["propellant-works"],
                name: "Propellant works",
                job: "Makes methane and oxygen from ice and Martian air.",
                after: "A gas plant and the cold-box towers of an air-separation plant. In fiction, the Alchemists’ Quarter of Red Mars.",
            },
            {
                at: ["tank-farm"],
                name: "Tank farm",
                job: "Stores methane and oxygen inside bund walls, between the works and the mount.",
                after: "Starbase’s row of vertical tanks.",
            },
            {
                at: ["control-tower"],
                name: "Harbour control",
                job: "Clears ships and landers in and out.",
                after: "An airport control tower.",
            },
            {
                at: ["rampart"],
                name: "Rampart",
                job: "A regolith bank between the pads and the city, against blast and dust.",
                after: "The berms of Baikonur and Starbase.",
            },
            {
                at: ["landing-way"],
                name: "Landing Way",
                job: "The main street, from the ring houses through the square to the Harbour Gate.",
                after: "The main street of Timgad, the Roman colony surveyed onto the Algerian desert, and Kennedy’s crawlerway.",
            },
            {
                at: ["water-works"],
                name: "Water works",
                job: "Ice is trucked in from the mine, melted and stored.",
                after: "A town water plant.",
            },
            {
                at: ["print-works"],
                name: "Print works",
                job: "Makes the city: gantry printers turn regolith into shells, blocks and arches.",
                after: "ICON’s construction printers and a precast yard.",
            },
            {
                at: ["reactor-park"],
                name: "Reactor park",
                job: "Power for the night and the dust storms, far from the homes and behind a berm.",
                after: "NASA’s Kilopower and Fission Surface Power. In fiction, the reactors that the first hundred of Red Mars called Chernobyl.",
            },
            {
                at: ["earth-station"],
                name: "Earth station",
                job: "The dish that carries the city’s traffic home.",
                after: "The 34-metre dishes at Goldstone.",
            },
            {
                at: ["solar-farm"],
                name: "Solar farm",
                job: "Daytime power, on tables with rails that sweep off the dust.",
                after: "A utility solar farm.",
            },
            {
                at: ["ship-b", "ship-c"],
                name: "Landed ship",
                job: "Ships that have arrived wait on their own bermed pads.",
            },
            {
                at: ["geo-hall"],
                name: "Geology hall",
                job: "Cores, samples and the field rovers that fetch them.",
                after: "The Crary Lab at McMurdo Station.",
            },
            {
                at: ["nursery"],
                name: "Nursery",
                job: "Seedlings under grow lamps before they go out to the farms.",
            },
            {
                at: ["hub-station", "bio-station"],
                name: "Maglev station",
                job: "Pods run the length of Canal Street.",
            },
            {
                at: ["depot"],
                name: "Depot",
                job: "Rovers and haul trucks park, charge and are repaired at the South Gate.",
                after: "McMurdo’s vehicle maintenance facility.",
            },
            {
                at: ["lander-berth"],
                name: "Cargo berth",
                job: "Cargo landers shuttle between the surface and orbit.",
            },
        ],
    },
};

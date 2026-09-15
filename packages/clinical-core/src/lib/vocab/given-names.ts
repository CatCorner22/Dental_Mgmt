// Common American given names, for the bare-name PHI heuristic.
//
// WHY A DICTIONARY: the PHI screen catches "Dr. Smith" because the honorific
// announces the name. "John Smith" announces nothing, so the only deterministic
// signal available is that "John" is overwhelmingly a person's name. A
// capitalized pair whose first word is on this list is worth a REVIEW flag;
// a capitalized pair alone is not, because clinical prose is full of them
// ("Angle Class", "Epworth Sleepiness", "Fort Sanders").
//
// CURATED, NOT COMPREHENSIVE. This is a screen, not a certification — the file
// header of phi.ts says so and it stays true. Roughly the few hundred most
// common US given names, minus deliberate exclusions:
//
//  - Month names (April, May, June): date prose has its own rules, and "May 3
//    days of antibiotics" must not read as a person.
//  - Names of clinical stains and materials that lead real two-cap phrases:
//    Rose (Rose Bengal), Crystal (Crystal Violet). A screen that flags a
//    mucosal stain as a patient teaches staff to ignore the screen.
//
// The cost of each exclusion is a missed "April Jones" — accepted, and
// documented here so the trade is a decision rather than an accident.
export const GIVEN_NAMES: ReadonlySet<string> = new Set([
  "aaron", "abigail", "adam", "adrian", "aiden", "alan", "albert", "alex",
  "alexander", "alexandra", "alexis", "alice", "alicia", "allison", "alyssa",
  "amanda", "amber", "amelia", "amy", "andrea", "andrew", "angela", "angelina",
  "anita", "ann", "anna", "anne", "annette", "anthony", "antonio", "arthur",
  "ashley", "aubrey", "audrey", "austin", "ava", "barbara", "beatrice",
  "becky", "benjamin", "bernard", "beth", "bethany", "betty", "beverly",
  "bill", "billy", "blake", "bob", "bobby", "bonnie", "brad", "bradley",
  "brandon", "brandy", "brenda", "brent", "brett", "brian", "brianna",
  "brittany", "brooke", "bruce", "bryan", "caleb", "cameron", "camila",
  "candace", "carl", "carla", "carlos", "carmen", "carol", "caroline",
  "carolyn", "carrie", "casey", "catherine", "cathy", "cecilia", "chad",
  "charles", "charlie", "charlotte", "chelsea", "cheryl", "chloe", "chris",
  "christian", "christina", "christine", "christopher", "cindy", "claire",
  "clara", "clarence", "claudia", "clifford", "clinton", "cody", "colin",
  "colleen", "connie", "connor", "cora", "corey", "courtney", "craig",
  "cynthia", "dale", "dan", "dana", "daniel", "danielle", "danny", "darlene",
  "darrell", "darren", "dave", "david", "deanna", "debbie", "deborah",
  "debra", "denise", "dennis", "derek", "diana", "diane", "dolores", "don",
  "donald", "donna", "doris", "dorothy", "doug", "douglas", "dustin", "dylan",
  "earl", "ed", "eddie", "edith", "edna", "eduardo", "edward", "edwin",
  "eileen", "elaine", "eleanor", "elena", "elias", "elijah", "elizabeth",
  "ella", "ellen", "emily", "emma", "eric", "erica", "erik", "erin", "ernest",
  "esther", "ethan", "eugene", "eva", "evan", "evelyn", "everett", "felicia",
  "felix", "fernando", "florence", "floyd", "frances", "francis", "francisco",
  "frank", "franklin", "fred", "frederick", "gabriel", "gabriella", "gail",
  "gary", "gene", "geneva", "geoffrey", "george", "gerald", "gilbert",
  "gina", "gladys", "glen", "glenn", "gloria", "gordon", "grace", "greg",
  "gregory", "gwendolyn", "hannah", "harold", "harry", "harvey", "heather",
  "helen", "henry", "herbert", "herman", "holly", "howard", "hugh", "ian",
  "irene", "isaac", "isabel", "isabella", "ivan", "jack", "jackie", "jacob",
  "jacqueline", "jaime", "jake", "james", "jamie", "jan", "jane", "janet",
  "janice", "jared", "jasmine", "jason", "javier", "jay", "jean", "jeanette",
  "jeff", "jeffrey", "jenna", "jennifer", "jenny", "jeremiah", "jeremy",
  "jerome", "jerry", "jesse", "jessica", "jesus", "jill", "jim", "jimmy",
  "joan", "joann", "joanna", "joanne", "jodi", "jody", "joe", "joel", "joey",
  "john", "johnny", "jon", "jonathan", "jordan", "jorge", "jose", "joseph",
  "josephine", "josh", "joshua", "joyce", "juan", "juanita", "judith", "judy",
  "julia", "julian", "julie", "justin", "kaitlyn", "karen", "kate",
  "katelyn", "katherine", "kathleen", "kathryn", "kathy", "katie", "katrina",
  "kayla", "keith", "kelly", "ken", "kenneth", "kevin", "kim", "kimberly",
  "kristen", "kristin", "kristina", "kurt", "kyle", "lance", "larry", "laura",
  "lauren", "laurie", "lawrence", "leah", "lee", "leo", "leon", "leonard",
  "leslie", "lester", "lewis", "liam", "lillian", "linda", "lindsay",
  "lindsey", "lisa", "lloyd", "logan", "lois", "lonnie", "loretta", "lori",
  "lorraine", "louis", "louise", "lucas", "lucille", "lucy", "luis", "luke",
  "lydia", "lynn", "madison", "manuel", "marc", "marcia", "marcus",
  "margaret", "maria", "marie", "marilyn", "mario", "marion", "marjorie",
  "mark", "marlene", "marsha", "martha", "martin", "marvin", "mary", "mason",
  "mateo", "matt", "matthew", "maureen", "maurice", "max", "megan", "melanie",
  "melinda", "melissa", "melvin", "meredith", "mia", "michael", "micheal",
  "michelle", "miguel", "mike", "mildred", "milton", "miranda", "miriam",
  "mitchell", "molly", "monica", "morgan", "nancy", "naomi", "natalie",
  "natasha", "nathan", "nathaniel", "neil", "nelson", "nicholas", "nicole",
  "nina", "noah", "nora", "norma", "norman", "oliver", "olivia", "omar",
  "oscar", "owen", "pam", "pamela", "patricia", "patrick", "paul", "paula",
  "pauline", "pedro", "peggy", "penny", "perry", "peter", "philip",
  "phillip", "phyllis", "priscilla", "rachel", "ralph", "ramon", "randall",
  "randy", "raul", "ray", "raymond", "rebecca", "regina", "renee", "rex",
  "rhonda", "ricardo", "richard", "rick", "ricky", "rita", "rob", "robert",
  "roberta", "roberto", "robin", "rodney", "roger", "roland", "ron",
  "ronald", "ronnie", "rosa", "ross", "roy", "ruben", "russell", "ruth",
  "ryan", "sabrina", "sally", "salvador", "sam", "samantha", "samuel",
  "sandra", "sandy", "sara", "sarah", "scott", "sean", "sebastian", "seth",
  "shane", "shannon", "sharon", "shawn", "sheila", "shelby", "sherry",
  "shirley", "sidney", "sofia", "sonia", "sophia", "spencer", "stacey",
  "stacy", "stanley", "stephanie", "stephen", "steve", "steven", "stuart",
  "sue", "susan", "suzanne", "sylvia", "tamara", "tammy", "tanya", "tara",
  "taylor", "ted", "teresa", "terrence", "terri", "terry", "thelma",
  "theodore", "theresa", "thomas", "tiffany", "tim", "timothy", "tina",
  "todd", "tom", "tommy", "toni", "tony", "tonya", "tracey", "traci",
  "tracy", "travis", "trevor", "tricia", "troy", "tyler", "valerie",
  "vanessa", "vera", "vernon", "veronica", "victor", "victoria", "vincent",
  "viola", "virginia", "vivian", "walter", "wanda", "warren", "wayne",
  "wendy", "wesley", "william", "willie", "wilson", "yolanda", "yvonne",
  "zachary", "zoe"
]);

// Hand-picked common English words likely to appear in clinical free text.
// The generated lexicon (lexicon-generated.ts) adds every word used in the
// skill documents; this list covers everyday filler the templates never use.
// Lowercase only.

const WORDS = `
able about above absent according account ache aching across action active activity actual
added additional address adjust adjusted adjustment adult advance advised after afternoon
again against ago agree agreed ahead alert all allow allowed almost alone along already also
although always among amount and announce another answer answered any anyone anything appear
applied applies apply appointment approach appropriate approve approved approximately are
area areas argue arm around arrange arrived as ask asked asks assist assistance assistant
assume at ate attempt attempted attend attention available average avoid avoided aware away
back bad balance base based basic be became because become been before began begin beginning
behind being believe below bend benefit best better between big bit bite bites biting black
bleed bleeding blood blue body bone bones both bottle bottom box boy break breath breathe
breathing brief briefly bring broke broken brother brought brush brushed brushes brushing
build burning business but buy by call called calm came can cannot cap car card care careful
carefully carried carry case cause caused center certain chair change changed changes chart
check checked cheek cheeks chest chew chewed chewing child children chin choice choose chose
clean cleaned cleaning clear clearly clench clenching clinic close closed closing cold
collect color come comes comfort comfortable coming common company complete completed
completely completes concern concerned condition confirm confirmed consider considered
contact continue continued control cool cooperative copy corner correct correctly cost could
count counted couple course cover covered crack cracked current currently cut daily damage
dark daughter day days deal decide decided decision decrease decreased deep degree delay
delayed delivery dental dentist dentistry deny department describe described detail
determine developed device did diet difference different difficult difficulty direct
direction directly discomfort discuss discussed discussion disease distance dizziness dizzy
do doctor does doing done door dose double down drainage drank drink drinking drive driven
driver driving drop dropped drove dry due dull during each ear early ease easily easy eat
eaten eating edge effect eight either else emergency empty end ended enough enter entire
episode equipment error especially even evening event events ever every everything exact
exactly examine examined example excellent except excess exercise expect expected experience
explain explained explanation expose exposed exposure extra extreme extremely eye eyes face
fact fair fall fallen family far fast father fear feel feeling feels feet fell felt fever
few field fifth file fill filled filling final finally find fine finger fingers finish
finished firm first fit five fix fixed flat floor floss flossed flossing flow follow followed
following food foods foot for form found four free frequent frequently fresh from front full
fully function further gag gagging gain gave general generally gentle gently get gets getting
girl give given gives giving glass go goes going gone good got gradual gradually great group
grow guard gum gums had half hand hands happen happened happens hard harm has have having he
head headache heal healed healing health healthy hear heard heart heat heavy held help helped
helpful helps her here high him his history hit hold holding home hot hour hours house how
however hurt hurting hurts ice idea identify if ill immediate immediately importance
important improve improved improvement in inch inches include included includes including
increase increased indicate infection inform information informed initial injury inside
instead instruction instructions intake interest into involve involved irritation is issue
issues it item items itself jaw job joint just keep keeping kept kind knew know known lack
large last late later learn least leave left less let level levels lie life lift light like
likely limit limited line lip lips liquid list listed listen little live lives living local
located location long longer look looked looking loose loosened lose loss lost lot loud low
lower made main maintain major make makes making male man manage managed many mark marked
match matter may maybe meal meals mean means meant measure measured medical medication
medications medicine meet member members mention mentioned met method middle might mild
milk mind mine minor minute minutes miss missed missing mother mouth move moved movement
moving much must my name named near nearly necessary neck need needed needs negative neither
nerve never new next nice night nine no noise none noon nor normally nose not note noted
notes nothing notice noticed now number numbness numb nurse observe observed obtain
occasional occasionally occur occurred of off office often oil old on once one only onset
open opened opening or oral order ordered other otherwise ounce our out outside over own pace
pack page paid pain painful pair pale paper parent parents part partial particular parts
past pattern pause pay people per perform performed perhaps period person phone photo
picture piece pill pills place placed placement plan planned planning plans plate play
pleasant please plenty point pointed points poor position positive possible practice
prefer preferred prepare prepared presence present presented press pressed pressure pretty
prevent prevented previous previously prior probably problem problems process product
products progress prompt properly provide provided provider pull pulled pulling pulse
purpose push pushed put question questions quick quickly quiet quite raise raised range rate
rather reach reached reaction read ready real really reason recall receive received recent
recently recommend recommended record records recover recovered recovery red reduce reduced
refer referred refill regarding region regular regularly relate related relative release
relief relieve relieved remain remained remove removed repair repeat repeated replace
replaced report reported request requested require required respond responded response rest
result results return returned review reviewed right rinse rinsed rinsing risk risks room
rough round routine rub rubber run running safe safety said same sat saw say scale schedule
scheduled school second section see seeing seem seemed seen self send sense sensitive
sensitivity sent serious seven several severe severity shall shape sharp she shift short
should shoulder show showed shown shows side sides sign signed signs similar simple since
sister sit site sites sitting situation six size sleep sleeping slept slight slightly slow
slowly small smell smoke smoked smoking smooth so social soft solid some someone something
sometimes son soon sore soreness sound sounds source space speak special specific speech
spend spent spit split spoke spot spouse spray spread stand standard start started starting
starts state stated statement states status stay stayed step steps stick sticky still stop
stopped stops story straight strange strength stress strong stronger such sudden suddenly
suggest suggested summary support sure surface swallow swallowing sweet swell swelling
swollen symptom symptoms system take taken takes taking talk talked taste team tear teeth
tell temperature ten tender tenderness term terms test tested testing tests text than thank
that the their them themselves then there these they thick thin thing things think third
thirty this those though thought three throat through throughout throbbing time times tired
tissue tissues to today together told tomorrow tongue tonight too took tooth toothache
tolerance tolerances
toothbrush toothpaste top total touch touched toward towards trauma travel treat treated
override overrides overridden
treatment tried trigger triggered trouble true try trying turn turned twenty twice two type
types under underneath understand understands understood unit until unusual up updated upon
upper upset urgent us use used uses using usual usually value verified verify very visit
visited visits wait waited waiting wake wear wearing week weekend weeks weight well went were
what when where whether which while white who whole why wide wife will window wisdom wish
with within without woke woman word words wore work worked working works worse worsened
worst would wrap wrist write written wrong year years yellow yes yesterday yet you young
your zero
awareness daytime instructed intolerance morning outstanding phases physician referring transient
`;

export const COMMON_LEXICON: ReadonlySet<string> = new Set(
  WORDS.split(/\s+/).filter(Boolean)
);

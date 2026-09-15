// Curated dental, oral-surgery, sedation, and clinical vocabulary.
// Lowercase. Used by the spelling audit (known-word pass + close-match suggestions).

const WORDS = `
abfraction abrasion abscess abutment acetaminophen adhesive airway aligner aligners
alginate allergies allergy alveolar alveolitis alveoloplasty alveolus amalgam amoxicillin
analgesic anaphylaxis anatomic anesthesia anesthetic angina ankylosed ankylosis antibiotic
anticoagulant antiseptic apex apical apicoectomy apnea archwire arrhythmia arthrocentesis
articaine articulator aspiration aspirin asthma asymptomatic attrition auscultation avulsion
azithromycin bacterial benzocaine bicuspid bifurcation bilateral biopsy bitewing bleaching
bonding bracket brackets bradycardia bridge bronchospasm bruxism buccal bupivacaine bur
calculus candidiasis canine cannula capnography carcinoma cardiac cardiovascular caries
carious carpule cavities cavity catheter cellulitis cementation cementum cephalometric ceramic chlorhexidine
circumferential clindamycin codeine comorbidity composite condylar condyle contraindication
coping coronal coronectomy crepitus crestal crossbite crown curettage curette cuspid cyst
debond debonding debridement decalcification decay decoronation defibrillator dehiscence
dentate dentin dentition denture dexamethasone diabetes diabetic diastema diazepam dislocation
displacement distal drainage dycal dysphagia dysplasia dyspnea ecchymosis edema edematous
edentulous elastics elastomer electrocardiogram elevator enamel endodontic endodontics
enucleation epinephrine epistaxis erosion eruption erythema erythematous eugenol exostosis
explorer extraction extrusion exudate facebow facial fentanyl fistula fitted fixation flange
fluctuant flumazenil fluoride fluorosis forceps formocresol fracture framework frenectomy
frenulum frenum friable furcation gauze gingiva gingival gingivectomy gingivitis
gingivoplasty graft granuloma gutta handpiece hematoma hemisection hemorrhage hemostasis
hemostat herpetic hydrocodone hydroxyzine hyperplasia hypersensitivity hypertension
hypertensive hypochlorite hypoplasia hypotension ibuprofen immobilization impacted impaction
implant incisal incision incisor indurated infection infiltration inflammation infraorbital
inlay interdental interocclusal interproximal intraoral intrusion intubation ionomer
ipsilateral irrigation keratinized ketamine labial laryngospasm lesion leukoplakia lidocaine
ligature lingual lozenge luxation malocclusion mandible mandibular marsupialization matrix
maxilla maxillary mepivacaine mesial metronidazole midazolam mobility molar mucogingival
mucosa mucosal mucositis naloxone naproxen necrosis necrotic neuralgia nitrous nonmobile
obturation occlusal occlusion odontogenic onlay openbite oropharynx orthodontic orthognathic
osseous osteitis osteoplasty osteotome osteotomy overbite overdenture overjet oximeter
oximetry oxycodone palatal palate palpation panoramic papilla papillary parafunction paresthesia
patency patent pedunculated penicillin percha pericoronitis periapical periodontal
periodontitis periodontium periotome petechiae pontic porcelain postoperative prednisone
premedication premolar preoperative prilocaine prophylactic prophylaxis propofol prosthesis
prosthetic pulp pulpal pulpectomy pulpitis pulpotomy purulent radiograph radiographic
radiolucency radiolucent radiopacity radiopaque ramus rebase recession reduction reline
replantation resection resin resorption restoration resuscitation retainer retention
retractor retreatment rongeur sanguineous scaler scaling sealant sedation septum serous
sessile sinus siloxane splint stomatitis subgingival sublingual submandibular
submentovertex suppuration supraeruption supragingival suture sutures symphysis syncope
syringe tachycardia tartar temporomandibular titanium tomography torus tori tramadol
transcranial transpharyngeal triazolam trigeminal trismus tuberosity ulcer ulceration
unilateral veneer verrucous vestibule vestibuloplasty xerostomia zirconia
injection injections saline irrigated granulation inferior superior anterior posterior
periapical interim provisional palliative
desensitizing efficacy protrusive whitening
`;

export const DENTAL_LEXICON: ReadonlySet<string> = new Set(
  WORDS.split(/\s+/).filter(Boolean)
);

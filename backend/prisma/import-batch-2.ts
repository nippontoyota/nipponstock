import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

function hardBlockExpiryFrom(baseDate: Date, days: number): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const baseIst = new Date(baseDate.getTime() + IST_OFFSET_MS);
  const expiryMidnightIst = Date.UTC(
    baseIst.getUTCFullYear(),
    baseIst.getUTCMonth(),
    baseIst.getUTCDate() + days,
  );
  return new Date(expiryMidnightIst - IST_OFFSET_MS + 23 * 60 * 60 * 1000);
}

// [stockyardLoc, model, suffix, colour, chassisNumber, assignmentDate, allottedBranch, orderId, customerName, teamLeaderName, consultantName]
const ROWS: [string,string,string,string,string,string,string,string,string,string,string][] = [
  ['CO01B','FRN','FRN4L','2PS','202606118368','2026-07-17','MV01A','8975815','SHAJU  JACOB','Basil  B Thottam 6344','Basil B Thottam 6344 Basil'],
  ['CO01B','FRN','FRN1L','2PS','202606118356','2026-07-24','MV01A','9058485','AGHERA KAPILKUMAR MANSUKHBHAI','Basil  B Thottam 6344','Muhamath Shefek 8838 Shefek'],
  ['CO01B','FRN','FRN1L','2PS','202606118357','2026-07-26','TI01A','9093894','DIRECTOR','Prajith  Prabhakaran 3773','Amruth Nadakkavil 7916 amruth'],
  ['CO01B','FRN','FRNB6','218','202606118371','2026-07-26','TI01A','8928674','SHANOJ C M','Smijith  Appraem 2216','Nikhil Chandrahasan 8276 Nikhil'],
  ['CO01B','FRN','FRNBK','089','202606118379','2026-07-29','TI01A','8890808','MOHAMMEDNISHIL THUDIYAN KAVIL','Smijith  Appraem 2216','Nikhil Chandrahasan 8276 Nikhil'],
  ['CO01B','FRN','FRN1L','2PS','202606118361','2026-07-30','MV01A','9068084','DAYANAND NILOBA PHAND','Ananthakrishna  Menon PS 4504','Ananthakrishna Menon PS 4504 Anantha'],
  ['CO01B','FRN','FRNCK','218','202606118390','2026-07-30','TI01A','9150793','11:30','Prajith  Prabhakaran 3773','Amruth Nadakkavil 7916 amruth'],
  ['CO01B','IMV','IMVIT','089','202606118421','2026-07-14','TI01A','9006833','REMESH K K','Smijith  Appraem 2216','Febin  Francis 7766 Febin'],
  ['CO01B','IMV','IMVIQ','089','202606118401','2026-07-21','MV01A','9036782','REJI  NINAN','Sumesh  Nair 4152','Sony Simon 9209 Sony'],
  ['CO01B','IMV','IMVIU','089','202606118437','2026-07-23','TI01A','8921186','BENNY C L','Deepak  TM 2243','Sreejith Peethambaran 8622 Sreejith'],
  ['CO01B','IMV','IMVIV','089','202606118441','2026-07-23','MV01A','9196522','RAJEESH K R','Sumesh  Nair 4152','Ratheesh R 332 Ratheesh'],
  ['CO01B','IMV','IMVIQ','1D6','202606118414','2026-07-24','TI01A','9143844','REJISH  ABRAHAM','Laiju  CV 770','Joffin AJ 7344 Joffin'],
  ['CO01B','IMV','IMVI8','089','202606118396','2026-07-26','TI01A','9036445','MUHAMMED MUGTHAR','Smijith  Appraem 2216','Sijil VS 8933 Sijil'],
  ['CO01B','IMV','IMVIT','089','202606118425','2026-07-28','MV01A','8971541','KSHEMON P A','Ananthakrishna  Menon PS 4504','Masoom Siraj 8121 Masoom'],
  ['CO01B','IMV','IMVIQ','089','202606118405','2026-07-29','MV01A','9141000','JOBY  GEORGE','Sumesh  Nair 4152','Sony Simon 9209 Sony'],
  ['CO01B','IMV','IMVIT','1D6','202606118431','2026-07-29','IR01A','','','',''],
  ['CO01B','IMV','IMVIQ','089','202606118407','2026-07-30','MV01A','9161920','DIRECTOR ALBINP ELDHO','Basil  B Thottam 6344','Muhamath Shefek 8838 Shefek'],
  ['CO01B','INN','INNYA','1D6','202606118505','2026-07-07','TI01A','9224287','SHANAVAS MUSLIMAVEETTIL ABDULLAH','Laiju  CV 770','Althaf VS 8556 Althaf'],
  ['CO01B','INN','INNYI','218','202606118611','2026-07-10','TI01A','8757714','RAVINDRAN V A','Joyson  CK 1021','Rahul M 6935 Rahul'],
  ['CO01B','INN','INNYK','089','202606118640','2026-07-10','IR01A','8799520','EDWIN  JOSE','Ratheesh  VV 775','Pranav KC 6395 Pranav'],
  ['CO01B','INN','INNYK','218','202606118651','2026-07-10','IR01A','8982106','P J SHAJI','Aju  Jose 4673','Abhilash O 5027 Abhilash'],
  ['CO01B','INN','INNYK','218','202606118652','2026-07-11','IR01A','9022114','MOHIND T','Aju  Jose 4673','Abhilash O 5027 Abhilash'],
  ['CO01B','INN','INNYI','089','202606118599','2026-07-14','TI01A','8728814','JITHIN K V','Smijith  Appraem 2216','Nikhil Chandrahasan 8276 Nikhil'],
  ['CO01B','INN','INNYB','089','202606118545','2026-07-16','TI01A','9174741','IBRAHEEM  EDERATH','Mojith  KM 2237','Harish  K R Harish'],
  ['CO01B','INN','INNYE','089','202606118562','2026-07-17','MV01A','9126547','SURESHKUMAR T C','Basil  B Thottam 6344','Anoop S 9016 Anoop'],
  ['CO01B','INN','INNYC','089','202606118554','2026-07-18','IR01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118487','2026-07-19','TI01A','8863925','SAJNA','Deepak  TM 2243','Rahul MR 7177 Rahul'],
  ['CO01B','INN','INNYA','089','202606118488','2026-07-21','MV01A','8912141','GEORGE MATHEW','','Eldho  N S 8544 Eldho'],
  ['CO01B','INN','INND4','089','202606118452','2026-07-22','IR01A','','','',''],
  ['CO01B','INN','INNYA','040','202606118471','2026-07-22','TI01A','9214631','NASEEBA  SHEHIM','Deepak  TM 2243','Sreejith Peethambaran 8622 Sreejith'],
  ['CO01B','INN','INNYA','089','202606118489','2026-07-22','MV01A','8952078','JALEEL  SHERIF','Basil  B Thottam 6344','Basil B Thottam 6344 Basil'],
  ['CO01B','INN','INNYA','089','202606118490','2026-07-22','TI01A','9164292','MIDHUN K M','Prajith  Prabhakaran 3773','Amruth Nadakkavil 7916 amruth'],
  ['CO01B','INN','INNYI','218','202606118615','2026-07-22','TI01A','8847330','SHIHAZ  K','Joyson  CK 1021','Abhimanyu CP 8528 Abhimanyu'],
  ['CO01B','INN','INNYA','221','202606118535','2026-07-23','TI01A','9008097','BISWAS KRISHNA NARAYANAN','Ratheesh  KR 779','Rohan Binoy 7821 Rohan'],
  ['CO01B','INN','INNYF','040','202606118583','2026-07-23','IR01A','','','',''],
  ['CO01B','INN','INNYF','221','202606118592','2026-07-23','MV01A','9147415','RIJO POONELY JOSE','Ananthakrishna  Menon PS 4504','Eljo Joy 8545 Eljo'],
  ['CO01B','INN','INNYA','4V8','202606118540','2026-07-24','IR01A','9195296','SAJAN KUNHIMOHAMED KANNEZHUTHU','Ratheesh  VV 775','Shihas VB 4494 Shihas'],
  ['CO01B','INN','INNYK','218','202606118658','2026-07-24','TI01A','8679517','SHAJUDHEEN NUMBER VEETIL','Joyson  CK 1021','Abhimanyu CP 8528 Abhimanyu'],
  ['CO01B','INN','INNYL','221','202606118684','2026-07-24','TI01A','8781024','MOHAMMED SAMEER TP','Prajith  Prabhakaran 3773','Amruth Nadakkavil 7916 amruth'],
  ['CO01B','INN','INNHZ','2PS','202606118459','2026-07-25','IR01A','','','',''],
  ['CO01B','INN','INNYI','089','202606118603','2026-07-25','MV01A','8921546','FAIZAL T A','Ananthakrishna  Menon PS 4504','Masoom Siraj 8121 Masoom'],
  ['CO01B','INN','INNHZ','2PS','202606118460','2026-07-26','IR01A','','','',''],
  ['CO01B','INN','INNYE','218','202606118576','2026-07-26','MV01A','8936641','LIJOSH  PHILIP','Sumesh  Nair 4152','Ratheesh R 332 Ratheesh'],
  ['CO01B','INN','INNYK','4V8','202606118672','2026-07-26','TI01A','9223302','TINO VINCENT','Ratheesh  KR 779','Riyas K S Riyas'],
  ['CO01B','INN','INNHZ','2PS','202606118461','2026-07-28','IR01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118497','2026-07-28','IR01A','9206134','PROPRIETOR ALBY JOSEPH','Ratheesh  VV 775','Anand Sebastian 4141 Anand'],
  ['CO01B','INN','INNYA','089','202606118498','2026-07-28','TI01A','9219764','SHIVAJI VITHOBA PATIL','Prajith  Prabhakaran 3773','Amruth Nadakkavil 7916 amruth'],
  ['CO01B','INN','INNYB','089','202606118548','2026-07-28','MV01A','9183747','LIBIN  PAULOSE','Ananthakrishna  Menon PS 4504','Martin Thomas 6953 Martin'],
  ['CO01B','INN','INNYA','218','202606118521','2026-07-29','IR01A','9183948','SAJITH V A','Ratheesh  VV 775','Shihas VB 4494 Shihas'],
  ['CO01B','INN','INNYA','218','202606118522','2026-07-29','MV01A','8990996','SIBICHAN V S','Ananthakrishna  Menon PS 4504','Masoom Siraj 8121 Masoom'],
  ['CO01B','INN','INNYI','218','202606118618','2026-07-29','MV01A','8913842','DIVYESH BABU','Shiyas  VS 8521','Nassar  PM 1833 Nassar'],
  ['CO01B','INN','INNYA','089','202606118501','2026-07-30','MV01A','9220340','ALEX  PUAL','Ananthakrishna  Menon PS 4504','Martin Thomas 6953 Martin'],
  ['CO01B','INN','INNYA','218','202606118523','2026-07-30','TI01A','8969759','MISNA  MOHAMED','Laiju  CV 770','Althaf VS 8556 Althaf'],
  ['CO01B','INN','INNYA','221','202606118538','2026-07-30','MV01A','9209922','BINU  VARGHESE','Sumesh  Nair 4152','Sony Simon 9209 Sony'],
  ['CO01B','INN','INNYJ','089','202606118628','2026-07-30','IR01A','8849594','SHIJU  GEORGE','Ratheesh  VV 775','Shihas VB 4494 Shihas'],
  ['CO01B','INN','INNYJ','221','202606118635','2026-07-30','IR01A','9116187','PREJO PHILIP ALUVATHINGAL','Ratheesh  VV 775','Shihas VB 4494 Shihas'],
  ['CO01B','INN','INNYK','089','202606118643','2026-07-30','TI01A','8526788','SANUB','Joyson  CK 1021','Faris RA 5943 Faris'],
  ['CO01B','INN','INNYK','218','202606118662','2026-07-30','MV01A','8919719','DIPU KARUNAN','Basil  B Thottam 6344','Muhamath Shefek 8838 Shefek'],
  ['CO01B','FRN','FRN4L','2PS','202606118367','2026-07-09','TR01A','9171463','NISAMUDEEN M','SUBIN  V','RINEESH S RINEESH'],
  ['CO01B','FRN','FRN1L','2PS','202606118351','2026-07-12','TR01A','9196438','ASHFAQ AHAMMED RA','ANISH  KABEER','JIKKU JAYAN JIKKUI'],
  ['CO01B','FRN','FRN1L','2PS','202606118352','2026-07-12','TR01C','9209633','RADHAKRISHNAN V','SREEJITH D D S','Reji  P G  Reji'],
  ['CO01B','FRN','FRN1L','2PS','202606118353','2026-07-17','TR01C','9251892','ABILA RAJ KL','PRASANTH . H','Jomi R Jomi'],
  ['CO01B','FRN','FRNBK','218','202606118382','2026-07-18','TR01A','9145907','SHAMEER S','SUBEER  K','VIJESH VS VIJESH'],
  ['CO01B','FRN','FRNBK','040','202606118375','2026-07-21','KL01A','','','',''],
  ['CO01B','FRN','FRNCK','089','202606118388','2026-07-21','KL01A','','','',''],
  ['CO01B','FRN','FRN1L','2PS','202606118358','2026-07-26','KL01A','','','',''],
  ['CO01B','FRN','FRNB6','2UE','202606118374','2026-07-30','TR01A','9209510','MOHAMMED HUSSAIN A','SUBIN  V','RINEESH S RINEESH'],
  ['CO01B','IMV','IMVIQ','089','202606118399','2026-07-04','KL01A','8925469','SAYED HUSBULLAH KOYATHANGAL','SHAHANAS  A','AAKASH ASHOK AAKASH'],
  ['CO01B','IMV','IMVIQ','1D6','202606118411','2026-07-04','TR01A','9217865','MOHAN C K','SUBEER  K','PRASOON  PRAKASH PRASOON'],
  ['CO01B','IMV','IMVI8','089','202606118394','2026-07-10','KL01A','','','',''],
  ['CO01B','IMV','IMVI8','089','202606118395','2026-07-16','TR01A','','','',''],
  ['CO01B','IMV','IMVIT','089','202606118422','2026-07-17','TR01C','8877691','NANDU S','KRISHNAKUMAR  V','Abhijith RS Abhijith'],
  ['CO01B','IMV','IMVIV','040','202606118439','2026-07-17','TR01C','9177845','A PRAKASH','VINOD  V G NAIR','Akhil BS  Nair Akhil'],
  ['CO01B','IMV','IMVIT','1D6','202606118430','2026-07-22','TR01C','','','',''],
  ['CO01B','IMV','IMVIW','218','202606118446','2026-07-23','TR01A','8975551','ANANTHA SIVAM NEELAKANDAN','SUBIN  V','GIRISH K R GIRISH'],
  ['CO01B','IMV','IMVIQ','089','202606118403','2026-07-25','TR01A','8983420','MURUKAN K','SUBEER  K','SIBIN BHAGAVATHY S SIBIN'],
  ['CO01B','IMV','IMVIQ','089','202606118404','2026-07-28','KL01A','9106672','FATHIMA  SHIYAS','NIYAS  N','MIDHUN MOHAN MIDHUN'],
  ['CO01B','IMV','IMVIQ','218','202606118416','2026-07-28','KL01A','9045882','JAFER  J','SUGESH  S','PRIYESH S PRIYESH'],
  ['CO01B','IMV','IMVIR','089','202606118417','2026-07-29','TR01C','9195121','BIBIN  M','VINOD  V G NAIR','SREEKANTH S SREE'],
  ['CO01B','IMV','IMVIQ','1D6','202606118415','2026-07-30','TR01C','9221780','ALLIANZ','VINOD  V G NAIR','Akhil BS  Nair Akhil'],
  ['CO01B','IMV','IMVIU','040','202606118435','2026-07-30','TR01C','8909764','SURYA SR','VINOD  V G NAIR','Vishnu SG Vishnu'],
  ['CO01B','INN','INNYA','040','202606118468','2026-07-04','TR01C','','','',''],
  ['CO01B','INN','INNYA','089','202606118473','2026-07-04','TR01C','9121853','SHAJIMON  KV','KRISHNAKUMAR  V','NANDAKUMAR N Nandakumar'],
  ['CO01B','INN','INNYK','218','202606118648','2026-07-05','TR01A','8891440','SHAHIN  T','SHAHANAS  A','ANANDHU T ANANDHU'],
  ['CO01B','INN','INND4','089','202606118451','2026-07-07','KL01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118474','2026-07-07','TR01C','9234042','JEGATHESH ARASUMANI','SREEKANTH  S S','Arun Raj RP Arun'],
  ['CO01B','INN','INNYA','089','202606118475','2026-07-07','TR01C','9239003','PRASAD M S','SREEKANTH  S S','AJIN CM AJIN'],
  ['CO01B','INN','INNYI','218','202606118610','2026-07-07','TR01A','8922080','VIJIL N V','SUBEER  K','VIJESH VS VIJESH'],
  ['CO01B','INN','INNYA','089','202606118476','2026-07-08','KL01A','','','',''],
  ['CO01B','INN','INNYK','218','202606118649','2026-07-08','TR01A','9008482','JAMSHEER K T','SUBEER  K','PRASOON  PRAKASH PRASOON'],
  ['CO01B','INN','INNYA','089','202606118477','2026-07-09','KL01A','','','',''],
  ['CO01B','INN','INNYC','089','202606118553','2026-07-10','TR01A','9088105','POWERLINK BUILDERS PRIVATE LIMITED','SUBIN  V','RINEESH S RINEESH'],
  ['CO01B','INN','INNYB','089','202606118544','2026-07-11','TR01C','','','',''],
  ['CO01B','INN','INNYF','040','202606118582','2026-07-13','TR01C','8523881','BINU T','VINOD  V G NAIR','Vishnu SG Vishnu'],
  ['CO01B','INN','INNHZ','2PS','202606118455','2026-07-14','TR01A','','','',''],
  ['CO01B','INN','INNYE','218','202606118575','2026-07-15','KL01A','9010265','SWARAJITH  B','SUGESH  S','SUJITH KUMAR S SUJITH'],
  ['CO01B','INN','INNHZ','2PS','202606118456','2026-07-16','TR01C','','','',''],
  ['CO01B','INN','INNYA','1D6','202606118507','2026-07-16','KL01A','','','',''],
  ['CO01B','INN','INNYI','089','202606118600','2026-07-16','TR01C','','','',''],
  ['CO01B','INN','INNHZ','2UE','202606118466','2026-07-17','KL01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118512','2026-07-17','TR01A','8854675','SIYAD AHAMMED S','SUBIN  V','RINEESH S RINEESH'],
  ['CO01B','INN','INNYA','221','202606118534','2026-07-17','KL01A','9101759','DILEEP RAMACHANDRAN PILLAI','SHAHANAS  A','AAKASH ASHOK AAKASH'],
  ['CO01B','INN','INNYI','218','202606118614','2026-07-18','KL01A','8936843','R  AJAYAKUMAR','KAILAS  S','SARATH  S R SARATH'],
  ['CO01B','INN','INNYI','221','202606118621','2026-07-19','KL01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118513','2026-07-21','KL01A','8919290','NOUFIYA  N','SHAHANAS  A','ANANDHU T ANANDHU'],
  ['CO01B','INN','INNYA','218','202606118514','2026-07-22','TR01C','9094861','SAKKEER  M','VINOD  V G NAIR','Akhil BS  Nair Akhil'],
  ['CO01B','INN','INNYE','089','202606118563','2026-07-22','KL01A','9153541','SAJIN  N','KAILAS  S','SAJITH KUMAR S S SAJITH'],
  ['CO01B','INN','INNYI','1D6','202606118607','2026-07-23','TR01C','','','',''],
  ['CO01B','INN','INNYJ','089','202606118626','2026-07-23','KL01A','8968848','NAJEEB  E','SHAHANAS  A','VIVEK AJ VIVEK'],
  ['CO01B','INN','INNYA','1D6','202606118509','2026-07-24','TR01C','','','',''],
  ['CO01B','INN','INNYK','218','202606118657','2026-07-24','TR01C','9103738','ALEX  P','SREEJITH D D S','Ajith Vijay VS Ajith'],
  ['CO01B','INN','INNYK','221','202606118667','2026-07-24','TR01C','9023889','JUSTIN L C','SREEJITH D D S','Reji  P G  Reji'],
  ['CO01B','INN','INNYB','089','202606118547','2026-07-25','TR01C','','','',''],
  ['CO01B','INN','INNYA','089','202606118495','2026-07-26','TR01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118496','2026-07-26','TR01A','','','',''],
  ['CO01B','INN','INNYD','089','202606118559','2026-07-26','KL01A','9044311','KANNAN MOHAMMED ANSARI','PRADEEP  R','MUHAMMED  HUSSAIN A MUHAMMED'],
  ['CO01B','INN','INNYI','218','202606118617','2026-07-26','TR01A','8987273','SUNIL KUMAR S','SUBEER  K','Jithin N Jithin'],
  ['CO01B','INN','INNYJ','089','202606118627','2026-07-26','TR01C','8975160','MOHANAKUMAR V P','SREEJITH D D S','Prince R Preman Prince'],
  ['CO01B','INN','INNYK','089','202606118642','2026-07-26','TR01A','8927321','AFNAN L J','PRASANTH   P','jackson Jude jackson'],
  ['CO01B','INN','INNYI','089','202606118604','2026-07-28','TR01C','','','',''],
  ['CO01B','INN','INNYK','218','202606118660','2026-07-28','KL01A','9044197','RAJESH KUMAR P','SUGESH  S','NIKHIL S NIKHIL'],
  ['CO01B','INN','INND4','040','202606118450','2026-07-29','TR01C','','','',''],
  ['CO01B','INN','INNYL','218','202606118679','2026-07-29','TR01A','9109464','AADHIL S','SUBEER  K','SIBIN BHAGAVATHY S SIBIN'],
  ['CO01B','INN','INNYA','040','202606118472','2026-07-30','TR01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118525','2026-07-30','TR01A','8912669','AL AMEEN M','PRASANTH   P','Adarsh M S Adarsh'],
  ['CO01B','INN','INNYE','089','202606118567','2026-07-30','TR01A','9173629','OOMMEN MATHEW MAMMOOTTIL','SUBEER  K','PRASOON  PRAKASH PRASOON'],
  ['CO01B','INN','INNYE','221','202606118580','2026-07-30','TR01A','9195153','ABHILASH S R','SUBIN  V','Sajan S Sajan'],
  ['CO01B','INN','INNYF','218','202606118591','2026-07-30','KL01A','9062212','NIZAR','SUGESH  S','SUJITH KUMAR S SUJITH'],
  ['CO01B','INN','INNYK','040','202606118637','2026-07-30','KL01A','9057039','NERI  SHIBU','NIYAS  N','MIDHUN MOHAN MIDHUN'],
  ['CO01B','INN','INNYL','040','202606118673','2026-07-30','TR01A','','','',''],
  ['CO01B','INN','INNYL','4V8','202606118688','2026-07-30','KL01A','9103341','Afsal  Y','ARUN  V R','SREERAJ  G S SREERA'],
  ['TR01A','INN','INNYE','1D6','ST5260719485','2026-07-30','KL01A','','','',''],
  ['CO01B','INN','INNYE','040','ST5260721944','2026-07-08','TR01A','','','',''],
  ['CO01B','FRN','FRN1L','2PS','202606118348','2026-07-04','CO01B','','','',''],
  ['CO01B','FRN','FRN4L','2PS','202606118366','2026-07-04','CO01B','','','',''],
  ['CO01B','FRN','FRNBK','089','202606118377','2026-07-04','CO01B','','','',''],
  ['CO01B','FRN','FRN1L','2PS','202606118349','2026-07-07','CO01A','','','',''],
  ['CO01B','FRN','FRN1L','2PS','202606118350','2026-07-09','KY01A','','','',''],
  ['CO01B','FRN','FRNBM','218','202606118385','2026-07-24','CO01B','','','',''],
  ['CO01B','FRN','FRN1L','2PS','202606118359','2026-07-29','CO01B','','','',''],
  ['CO01B','FRN','FRNBK','218','202606118383','2026-07-29','CO01A','','','',''],
  ['CO01B','FRN','FRNCK','040','202606118387','2026-07-29','CO01B','','','',''],
  ['CO01B','FRN','FRNBK','040','202606118376','2026-07-30','CO01B','','','',''],
  ['CO01B','IMV','IMVI8','040','202606118391','2026-07-08','CO01A','','','',''],
  ['CO01B','IMV','IMVIT','4V8','202606118433','2026-07-08','CO01A','','','',''],
  ['CO01B','IMV','IMVIT','040','202606118418','2026-07-09','CO01B','','','',''],
  ['CO01B','IMV','IMVIU','089','202606118436','2026-07-09','CO01B','','','',''],
  ['CO01B','IMV','IMVIT','1D6','202606118429','2026-07-11','KY01A','','','',''],
  ['CO01B','IMV','IMVIQ','1D6','202606118412','2026-07-12','KY01A','','','',''],
  ['CO01B','IMV','IMVIW','4V8','202606118447','2026-07-14','CO01A','','','',''],
  ['CO01B','IMV','IMVIV','089','202606118440','2026-07-16','CO01B','','','',''],
  ['CO01B','IMV','IMVIQ','040','202606118398','2026-07-17','CO01A','','','',''],
  ['CO01B','IMV','IMVI8','040','202606118392','2026-07-22','CO01A','','','',''],
  ['CO01B','IMV','IMVIT','089','202606118423','2026-07-22','CO01B','','','',''],
  ['CO01B','IMV','IMVIQ','089','202606118402','2026-07-23','CO01B','','','',''],
  ['CO01B','IMV','IMVIT','089','202606118426','2026-07-30','CO01A','','','',''],
  ['CO01B','IMV','IMVI8','089','ST5260722147','2026-07-18','CO01B','','','',''],
  ['CO01B','INN','INNHZ','2UE','202606118465','2026-07-04','CO01B','','','',''],
  ['CO01B','INN','INNYC','089','202606118552','2026-07-04','CO01B','','','',''],
  ['CO01B','INN','INNYI','089','202606118597','2026-07-04','CO01A','','','',''],
  ['CO01B','INN','INNYI','218','202606118608','2026-07-04','CO01A','','','',''],
  ['CO01B','INN','INND4','040','202606118448','2026-07-05','CO01B','','','',''],
  ['CO01B','INN','INNYJ','040','202606118624','2026-07-05','CO01B','','','',''],
  ['CO01B','INN','INNHZ','2PS','202606118453','2026-07-08','CO01A','','','',''],
  ['CO01B','INN','INNYB','089','202606118543','2026-07-08','CO01A','','','',''],
  ['CO01B','INN','INNYK','040','202606118636','2026-07-09','CO01B','','','',''],
  ['CO01B','INN','INNHZ','2PS','202606118454','2026-07-10','CO01B','','','',''],
  ['CO01B','INN','INNYA','089','202606118478','2026-07-10','CO01B','','','',''],
  ['CO01B','INN','INNYA','1D6','202606118506','2026-07-10','CO01A','','','',''],
  ['CO01B','INN','INNYA','040','202606118469','2026-07-11','CO01B','','','',''],
  ['CO01B','INN','INNYA','089','202606118479','2026-07-11','CO01A','','','',''],
  ['CO01B','INN','INNYI','218','202606118612','2026-07-11','CO01B','','','',''],
  ['CO01B','INN','INNYA','089','202606118480','2026-07-12','KY01A','','','',''],
  ['CO01B','INN','INNYE','1D6','202606118570','2026-07-13','CO01B','','','',''],
  ['CO01B','INN','INNYA','089','202606118481','2026-07-14','CO01B','','','',''],
  ['CO01B','INN','INNYA','221','202606118533','2026-07-14','CO01B','','','',''],
  ['CO01B','INN','INNYA','089','202606118482','2026-07-15','CO01A','','','',''],
  ['CO01B','INN','INNYK','218','202606118653','2026-07-15','CO01B','','','',''],
  ['CO01B','INN','INNYK','218','202606118654','2026-07-15','CO01A','','','',''],
  ['CO01B','INN','INNYK','218','202606118656','2026-07-17','KY01A','','','',''],
  ['CO01B','INN','INNYA','1D6','202606118508','2026-07-19','CO01B','','','',''],
  ['CO01B','INN','INNYI','089','202606118601','2026-07-19','CO01B','','','',''],
  ['CO01B','INN','INNYB','089','202606118546','2026-07-21','CO01B','','','',''],
  ['CO01B','INN','INNYJ','218','202606118631','2026-07-22','CO01A','','','',''],
  ['CO01B','INN','INNYK','089','202606118641','2026-07-22','CO01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118491','2026-07-23','KY01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118515','2026-07-23','CO01B','','','',''],
  ['CO01B','INN','INNYE','221','202606118579','2026-07-23','CO01A','','','',''],
  ['CO01B','INN','INNYF','089','202606118588','2026-07-23','CO01A','','','',''],
  ['CO01B','INN','INNYI','218','202606118616','2026-07-23','KY01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118492','2026-07-24','CO01B','','','',''],
  ['CO01B','INN','INNYL','089','202606118674','2026-07-24','CO01B','','','',''],
  ['CO01B','INN','INNYA','089','202606118493','2026-07-25','CO01B','','','',''],
  ['CO01B','INN','INNYA','089','202606118494','2026-07-25','CO01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118516','2026-07-25','CO01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118517','2026-07-25','KY01A','','','',''],
  ['CO01B','INN','INNYB','218','202606118550','2026-07-26','CO01B','','','',''],
  ['CO01B','INN','INNYI','221','202606118622','2026-07-28','CO01B','','','',''],
  ['CO01B','INN','INNYK','221','202606118668','2026-07-28','CO01B','','','',''],
  ['CO01B','INN','INNHZ','2PS','202606118462','2026-07-29','KY01A','','','',''],
  ['CO01B','INN','INNYA','221','202606118537','2026-07-29','CO01A','','','',''],
  ['CO01B','INN','INNYE','089','202606118565','2026-07-29','CO01B','','','',''],
  ['CO01B','INN','INNYF','040','202606118584','2026-07-29','CO01B','','','',''],
  ['CO01B','INN','INNYI','040','202606118595','2026-07-29','CO01B','','','',''],
  ['CO01B','INN','INNYK','218','202606118661','2026-07-29','CO01B','','','',''],
  ['CO01B','INN','INNYL','221','202606118685','2026-07-29','CO01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118524','2026-07-30','CO01B','','','',''],
  ['CO01B','INN','INNYI','089','202606118605','2026-07-30','KY01A','','','',''],
  ['CO01B','FRN','FRNBK','218','202606118381','2026-07-04','KT01A','','','',''],
  ['CO01B','FRN','FRNB6','2PS','202606118372','2026-07-18','PH01A','','','',''],
  ['CO01B','FRN','FRN1L','2PS','202606118354','2026-07-21','PH01A','','','',''],
  ['CO01B','FRN','FRNBK','089','202606118378','2026-07-21','KT01A','','','',''],
  ['CO01B','FRN','FRN1L','2PS','202606118355','2026-07-24','TL01A','','','',''],
  ['CO01B','FRN','FRN4L','2PS','202606118369','2026-07-24','KT01A','','','',''],
  ['CO01B','FRN','FRN1L','2PS','202606118360','2026-07-29','KT01A','','','',''],
  ['CO01B','IMV','IMVIT','1D6','202606118428','2026-07-04','KT01A','','','',''],
  ['CO01B','IMV','IMVIT','089','202606118420','2026-07-07','TL01A','','','',''],
  ['CO01B','IMV','IMVIQ','089','202606118400','2026-07-18','PH01A','','','',''],
  ['CO01B','IMV','IMVIT','089','202606118424','2026-07-25','PH01A','','','',''],
  ['CO01B','IMV','IMVIV','218','202606118444','2026-07-26','KT01A','','','',''],
  ['CO01B','IMV','IMVI8','089','202606118397','2026-07-29','KT01A','','','',''],
  ['CO01B','IMV','IMVIU','089','202606118438','2026-07-29','KT01A','','','',''],
  ['CO01B','IMV','IMVIV','089','202606118442','2026-07-29','TL01A','','','',''],
  ['CO01B','INN','INNYA','1D6','202606118504','2026-07-04','TL01A','','','',''],
  ['CO01B','INN','INNYA','221','202606118532','2026-07-04','KT01A','','','',''],
  ['CO01B','INN','INNYB','089','202606118542','2026-07-04','PH01A','','','',''],
  ['CO01B','INN','INNYE','089','202606118561','2026-07-04','KT01A','','','',''],
  ['CO01B','INN','INNYE','218','202606118573','2026-07-04','TL01A','','','',''],
  ['CO01B','INN','INNYI','218','202606118609','2026-07-04','TL01A','','','',''],
  ['CO01B','INN','INNYI','221','202606118620','2026-07-04','PH01A','','','',''],
  ['CO01B','INN','INNYK','089','202606118638','2026-07-04','KT01A','','','',''],
  ['CO01B','INN','INNYK','218','202606118646','2026-07-04','KT01A','','','',''],
  ['CO01B','INN','INNYK','218','202606118647','2026-07-04','KT01A','','','',''],
  ['CO01B','INN','INNYI','089','202606118598','2026-07-09','KT01A','','','',''],
  ['CO01B','INN','INNYF','089','202606118587','2026-07-14','PH01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118483','2026-07-15','KT01A','','','',''],
  ['CO01B','INN','INNYI','218','202606118613','2026-07-15','PH01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118484','2026-07-16','KT01A','','','',''],
  ['CO01B','INN','INNYK','218','202606118655','2026-07-16','PH01A','','','',''],
  ['CO01B','INN','INNYA','040','202606118470','2026-07-17','KT01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118485','2026-07-17','KT01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118486','2026-07-18','TL01A','','','',''],
  ['CO01B','INN','INNYE','1D6','202606118571','2026-07-22','PH01A','','','',''],
  ['CO01B','INN','INNYI','089','202606118602','2026-07-22','TL01A','','','',''],
  ['CO01B','INN','INNYL','218','202606118677','2026-07-24','PH01A','','','',''],
  ['CO01B','INN','INNYC','089','202606118555','2026-07-25','TL01A','','','',''],
  ['CO01B','INN','INNYK','218','202606118659','2026-07-25','TL01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118518','2026-07-26','KT01A','','','',''],
  ['CO01B','INN','INNYB','221','202606118551','2026-07-26','KT01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118499','2026-07-28','KT01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118519','2026-07-28','TL01A','','','',''],
  ['CO01B','INN','INNYA','218','202606118520','2026-07-28','KT01A','','','',''],
  ['CO01B','INN','INNYA','221','202606118536','2026-07-28','KT01A','','','',''],
  ['CO01B','INN','INNYC','221','202606118558','2026-07-28','TL01A','','','',''],
  ['CO01B','INN','INNYI','4V8','202606118623','2026-07-28','KT01A','','','',''],
  ['CO01B','INN','INNYJ','218','202606118632','2026-07-28','KT01A','','','',''],
  ['CO01B','INN','INNYA','089','202606118500','2026-07-29','KT01A','','','',''],
  ['CO01B','INN','INNYE','089','202606118566','2026-07-30','PH01A','','','',''],
  ['CO01B','INN','INNYK','221','202606118669','2026-07-30','KT01A','','','',''],
  ['CO01B','INN','INNYL','218','202606118680','2026-07-30','KT01A','','','',''],
  // duplicate 202606118395 with PH01A skipped (first occurrence TR01A used above)
];

async function main() {
  const branches = await prisma.branch.findMany({ select: { id: true, branchCode: true } });
  const branchByCode = new Map<string, string>();
  for (const b of branches) if (b.branchCode) branchByCode.set(b.branchCode, b.id as string);

  const sms = await prisma.user.findMany({
    where: { role: 'SALES_MANAGER' },
    select: { id: true, branchId: true },
  });
  const smByBranch = new Map<string, string>();
  for (const sm of sms) {
    if (sm.branchId && !smByBranch.has(sm.branchId)) smByBranch.set(sm.branchId, sm.id);
  }

  let created = 0, skipped = 0, warned = 0;
  const seenChassis = new Set<string>();

  for (const [stockyardLoc, model, suffix, colour, chassisNumber, assignmentDateStr, allottedBranch, orderId, customerName, teamLeaderName, consultantName] of ROWS) {
    if (seenChassis.has(chassisNumber)) {
      console.warn(`⚠️  Duplicate chassis in input: ${chassisNumber} — skipping`);
      warned++;
      continue;
    }
    seenChassis.add(chassisNumber);

    const physicalBranchId = branchByCode.get(stockyardLoc);
    const allottedBranchId = branchByCode.get(allottedBranch);

    if (!physicalBranchId) { console.warn(`⚠️  Unknown stockyardLoc branch: ${stockyardLoc} (${chassisNumber})`); warned++; continue; }
    if (!allottedBranchId) { console.warn(`⚠️  Unknown allotted branch: ${allottedBranch} (${chassisNumber})`); warned++; continue; }

    const smId = smByBranch.get(allottedBranchId);
    if (!smId) { console.warn(`⚠️  No SM for branch ${allottedBranch} (${chassisNumber})`); warned++; continue; }

    const assignmentDate = new Date(assignmentDateStr);
    const expiryAt = hardBlockExpiryFrom(assignmentDate, 30);

    const vehicle = await prisma.vehicle.upsert({
      where: { chassisNumber },
      update: {
        model, suffix, colour,
        chassisYear: 2026,
        stockStatus: 'MDDP' as any,
        stockyardLocation: stockyardLoc,
        physicalStockBranchId: physicalBranchId,
        assignmentDate,
        status: 'HARD_BLOCKED' as any,
      },
      create: {
        chassisNumber, model, suffix, colour,
        chassisYear: 2026,
        stockStatus: 'MDDP' as any,
        stockyardLocation: stockyardLoc,
        physicalStockBranchId: physicalBranchId,
        assignmentDate,
        status: 'HARD_BLOCKED' as any,
      },
    });

    const existing = await prisma.blockingRequest.findFirst({
      where: { vehicleId: vehicle.id, status: 'ACTIVE' },
    });

    if (existing) {
      console.log(`ℹ️  ${chassisNumber} already has active block — skipped`);
      skipped++;
      continue;
    }

    const now = new Date();
    await prisma.blockingRequest.create({
      data: {
        vehicleId: vehicle.id,
        userId: smId,
        branchId: allottedBranchId,
        blockType: 'HARD',
        status: 'ACTIVE',
        softBlockAt: now,
        hardBlockAt: now,
        expiryAt,
        orderId: orderId || undefined,
        customerName: customerName || undefined,
        teamLeaderName: teamLeaderName || undefined,
        consultantName: consultantName || undefined,
      },
    });

    console.log(`✅ ${chassisNumber} → ${allottedBranch}`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped (already blocked), ${warned} warnings`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

import fs from "node:fs";

export const RAW_TSV = `Student Name	Student Whatsapp Number 	Place 	Class	Syllabus 	Days Selected for Class	Preferred Time (IST)	Amount Paid	Package	Class Starting Date 	Subjects	Parent/Guardian Name	Parent/Guardian Whatsapp No	DEMO CONVERTED TRAINER
Rithik p	8129596322	Beypore	VIII	ICSE	Monday, Wednesday, Friday	09:00:00	3000	Monthly Package (3 Classes/week)	16/04/2026				shabeeha Malik
Aiden Dinny 	0523822533 ., 0562786297	Abudhabi 	Grade 4	CBSE	Monday, Tuesday, Thursday, Friday, Satur	06:07:00	5000/-	Monthly Package ( 5 Classes/week)	18/04/2026				Vafa PV
Devna jayesh	0097466799432	Qatar	7	CBSE	Friday, Satur	19:00:00	250	10 classes 	24/04/2026				Vafa PV
ALAN SHAIJU 	9526365265	Palakkad	10 th 	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	11:30:00	5000/-	Monthly Package ( 5 Classes/week)	21/04/2026				Shabeeha Malik
Neda Jamal	9995313742	Thiruvananthapuram 	10	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	10:00:00	₹4000	3 weeks(15 classes) 	22/04/2026				Vafa PV
Muhammed Farhan 	+971 58 115 1890	Abudhabhi 	9	Kerala State	Tuesday, Wednesday, Thursday	10:30:00	3000	Monthly Package (3 Classes/week)	23/04/2026				Anshad
Angela Elsa Renju	0097339530015	Bahrain 	9	CBSE	Monday, Tuesday, Wednesday, Thursday, Satur, Sunday	06:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	23/04/2026	all			shabeeha Malik
Anugraha Umesh C 	9946428932	Kodungallur 	10	CBSE	Monday, Wednesday, Friday	19:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	27/04/2026	Social science and science 			Nihal Moidhin
AADINATH S	9633123842	THIRUVANANTHAPURAM	10	Kerala State	Monday, Wednesday, Friday	07:00:00		12 Classes - Monthly Package (3 Classes/week)	01/05/2026	MATHEMATICS			Asma
Fathima A shakeer 	9526340646	Marathancodu kunnamkulam 	9	CBSE	Tuesday, Wednesday, Thursday	00:09:00	3000	12 Classes - Monthly Package (3 Classes/week)	05/05/2026	Maths. Chemistry. Physics 			Ranjitha
Angelina Sara Tiju	9447541221	Adoor	11	CBSE	Monday, Wednesday, Friday, Satur	05:00:00	6000	16 Classes - Monthly Package (4 Classes / Week )	04/05/2026	Biology, Chemistry, Physics, Mathematics 			Nihal
Aviah	9740156868/9731858968	Bangalore, Karnataka	9th	CBSE	Monday, Tuesday, Thursday, Friday	17:00:00	₹4,000 	16 Classes - Monthly Package (4 Classes / Week )	04/05/2026	Math 			Maha
Ziya Abinawas	00971 501554700	Kuwait	8	CBSE	Monday, Tuesday, Sunday		3000	12 Classes - Monthly Package (3 Classes/week)	10/05/2026	Maths			Nithin
Nabhan	7510145141	India	10	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	04:05:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	05/05/0026	Maths, science and social science 			Ranjitha
Zahil Abinavas	00965 99867490	Kuwait 	8	CBSE	Monday, Tuesday, Sunday		3000	12 Classes - Monthly Package (3 Classes/week)	10/05/2026	Maths			Nithin
Ayan Anees	0097333975886     00919526307344	Bahrain	6	CBSE	Monday, Tuesday, Wednesday, Thursday, Sunday	17:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	06/05/2026	Maths Hindi social science science English 			Asma
Lazhar kamal	0097335424006	Bahrain	6	CBSE	Monday, Tuesday, Wednesday, Thursday, Satur	07:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	06/05/2026	Maths, Hindi, science, social studies, English			Maha
Mifzal rahan	+918590315446	Sharjah	9	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	20:30:00	7000	6 per week	07/05/2026	Maths,science,social,english			Maha
Mayookha Prabhu	8547472026	Mavelikkara, Alapuzha	10th	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	19:00:00	7000/-	24 classes	08/05/2026	Hindi, social,  maths Physics chemistryBiology			Maha,Ranjitha
Salih Mohamed	+919747548558	Qatar	10th	CBSE	Monday, Wednesday, Satur	19:30:00	3000	12 Classes - Monthly Package (3 Classes/week)	09/05/2026	Maths			Maha
Prakriti prajin 	9995129168	Thrissur 	2	CBSE	Friday	19:30:00		One class per week 	15/05/2026	Hindi			Nithin
Aganaya Sreejith 	9562579269	Purapuzha (thodupuzha)	7	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	06:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	14/05/2026	Math and hindi 			Asma
Ehaan Anees	973,339,758,860,097,000,000,000	Bahrain 	3	CBSE	Monday, Tuesday, Wednesday, Thursday, Sunday	17:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	18/05/2026	Maths ,Evs ,Hindi,English ,arabic			None
Saarang Arjun	8593033697	Thrissur	12th	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	20:30:00	9000	24 Classes- Monthly Package(6classes/week)	20/05/2026	PCM			Neha
Muhammad hamdan kasim 	9544017999	Manjery 	4 th std	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	10:30:00	3600	24 classes 	21/05/2026	English,malayalam,Hindi 			Vafa
Krithik. C Krishnan 	7907911907	Guruvayoor 	10th	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday	05:30:00	10000	40 classes- Monthly package(10 classes/week)	25/05/2026	All subject(Sanskrit)			Maha
Siona Sajeesh	+61466205197	Australia 	Grade 7	CBSE	Satur, Sunday	08:00:00	2400	2 class per week	29/05/2026	Mathematics 			Nithin
Zain Sajeesh 	+61466205197	Australia 	Grade 5	CBSE	Satur, Sunday	09:00:00	2400	2 class per week	29/05/2026	Mathematics 			Maha
Rihan Bin Rafeek	0097455209533	Qatar	7	CBSE	Thursday, Friday, Satur	21:30:00		12 Classes - Monthly Package (3 Classes/week)	29/05/2026	Arabic			Vafa 
RYAN MELVIN FERNANDEZ	9620732530	KOCHI	9	CBSE	Monday, Wednesday, Friday	15:30:00	3000/-	12 Classes - Monthly Package (3 Classes/week)	01/06/2026	MATHS & HINDI			Maha
Anwita Abhilash 	9871030663	Ernakulam	Class - VII (NCERT)	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	18:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	01/06/2026	Mathematics, Science & Social, Hindi (Opt. Malayalam)			Thansheera
Diya Harikumar D	7994419348	Karumkulam, TVM	VHSE	Kerala State	Monday, Tuesday, Wednesday	07:00:00	7500	20 Classes - Monthly Package ( 5 Classes/week)	01/06/2026	Chemistry, Biology			Neha, Ifna
Adline Mariyam Sam 	+61494390336	Australia 	1	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	01:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	02/06/2025	English 			Vafa
Asthik manesh	7034742563	Payyavoor	7	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	19:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	01/06/2026	Maths,malayalam,english,science,hindi			Suhaila
Tanve C Vijith	9048627979	Anthikad 	5th 	CBSE	Monday, Thursday, Sunday	07:30:00	3000	12 Classes - Monthly Package (3 Classes/week)	31/05/2026	Mathematics 			Aysha 
ARUNDHATHI R NAIR 	8139088482	THIRUVALLA	9th	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	19:00:00	5000 INR	20 Classes - Monthly Package ( 5 Classes/week)	01/06/2026	All subject excluding malayalam and social science 			shilpa
Reathaj	78876928	Oman	X	CBSE	Sunday	07:30:00	400	1 class	31/05/2026	Math, physics 			ashna
Alicia Sara Shiju	9074201181	Trivandrum 	6	CBSE	Tuesday, Thursday, Satur	20:00:00	Rs 3000	12 Classes - Monthly Package (3 Classes/week)	02/06/2026	Maths, Science, IT Elements 			shilpa
Anshif M	+971 52 774 1098/+91 97784 52241	Wayanad	7	CBSE	Tuesday, Wednesday, Thursday	19:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	02/06/2026	Math			Nawar
Evelyn elza George 	971589133109	Doha	Year10	ICSE	Tuesday	18:00:00	1200	Weekly one 	02/06/2026	Arabic 			vafa
Nainika Sreejith 	0501719576	UAE	8	CBSE	Monday, Wednesday, Friday		30000	12 Classes - Monthly Package (3 Classes/week)	02/06/2026	Math			Fouzanath
Eeva Izza Fathima	9995044089	Thandekkad	8	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	08:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	04/06/2026	Maths   Malayalam    Hindi			Vafa
Alan Robin	9995259954	Irritty	8	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday		5000	20 Classes - Monthly Package ( 5 Classes/week)	04/06/2026	Chemistry, physic, english, maths, social 			shahara
Ashley JACOB 	8089136184	Kundara 	8	CBSE	Monday, Wednesday, Satur	05:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	06/06/0026	Maths, science, social science 			maha
Angeline linto	85415601	Singapore 	P5	ICSE	Monday, Wednesday, Friday, Satur, Sunday	08:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	06/06/2026	English			shilpa
Hazim Ahamed	+966530095507	Calicut	12	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	00:00:00	13,500	24 days class	06/06/2026	chemsitry			neha
Alan sajo	+91 87147 51676	Piravom 	2nd 	CBSE	Tuesday, Wednesday, Thursday, Friday	17:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	08/06/2026	All subjects 			nithin
RiyanRejish	8589020496	Iringannur	5	CBSE	Monday, Wednesday, Sunday	06:07:00	3000	12 Classes - Monthly Package (3 Classes/week)	07/06/0026	Maths, malayalam, hindi			nithin
Jude Mathews	9847410986	Changanacherry 	4	ICSE	Tuesday, Thursday, Satur	19:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	09/06/2026	Maths ,Hindi 			Thabsheera
Karthikeyan D	8089951919, +971-552405380, +971-555105380	Kollam	9	CBSE	Monday, Tuesday, Thursday, Friday, Sunday	18:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	08/06/2026	Maths, Physics, Chemistry, Biology and English			Maha
Brindha. R	6282031097	Palakkad	*2	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday	06:30:00	7500	20 Classes - Monthly Package ( 5 Classes/week)	08/06/2026	Maths, Chemistry, Biology			Ihsan, shameema
Crystal Mary Roy	9526597189	Pazhyampallil (H), Mannanam P.O, Kottayam 	10	ICSE	Monday, Wednesday, Friday	05:06:00	₹3000	12 Classes - Monthly Package (3 Classes/week)	08/06/2026	Physics 			Ashna
Abdulla zainadeen 	9633492835	Ambalapuzha	+2	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday	21:00:00	2000	5classes	08/06/2026	Computer applications 			Farhana Sherin
Reeshah Haleem 	9526500640	Kuttiady 	10	CBSE	Tuesday, Satur, Sunday	18:00:00	Rs3000/-	12 Classes - Monthly Package (3 Classes/week)	13/06/2026	Mathematics 			Maha, Ashna
Munawar Ibrahim	9746955717	Kasaragod	10	Kerala State	Tuesday, Thursday, Satur	21:10:00	3000	12 Classes - Monthly Package (3 Classes/week)	16/06/2026	Maths, social, physics, biology, chemistry, hindi, malayalam			shahara
ABHIRAM ASHOK	85907 45396	THIRUVALLA,PATHANAMTHITTA DIST	10th 	ICSE	Monday, Tuesday, Wednesday, Thursday, Friday	06:07:00	Yes	20 Classes - Monthly Package ( 5 Classes/week)	18/06/2026	Maths, physics, chemistry, biology 			Ashna
Faiza	+91 8921750220	Thrissur	10	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	21:00:00		20 Classes - Monthly Package ( 5 Classes/week)	17/06/2026	Math, Chemistry , Biology , Physics , Social Studies			maha
Jenn Riya Sam 	9292427180	Chennai	Plus one 	CBSE	Monday, Wednesday, Thursday	19:00:00	4000	12 Classes - Monthly Package (3 Classes/week)	22/06/2026	Biology, Chemistry and Physics 			ifna
Mohammed yaseen	9961683002	Thiruvalla	10	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday	19:30:00	10000	Weekly 10 classes 	22/06/2026	Mal eng hindi maths social bio phy chem			shahara
Jewel Elizabeth Cyriac 	+353894217673	Ireland	4	Ireland 	Monday, Tuesday, Wednesday, Thursday, Friday	17:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	29/06/2026	English,  Maths			aswathi b
Erin Jinu George	00974 33940696	Qatar	10	CBSE	Monday, Tuesday, Wednesday, Thursday, Sunday	21:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	01/07/2026	MATHS,SCIENCE			NAWAR
SHRUTI POLIN JONES	+91 81370 09530	Thiruvalla	X	CBSE	Tuesday, Thursday, Friday	06:30:00	3000	12 Classes - Monthly Package (3 Classes/week)	01/07/2026	Science. Social science. English			fidha
RAIBAL JIYO	9074622408	EDATHIRUTHY	4	ICSE	Monday, Wednesday, Friday	07:15:00	3000	12 Classes - Monthly Package (3 Classes/week)	01/07/2026	SCIENCE & SOCIAL			aswani 
Hanna Shanavas 	0563327914	UAE	9	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	11:30:00	6000	6 Classes / Week	06/07/2026	Maths, Science,  English,  Social Science, Arabic			Nawar
Muhammed Shebin P	9947923493	Kerala,kannur,irikkur	10	CBSE	Monday, Wednesday, Friday	05:06:00	8500	3 months 3 classes per week	06/07/2026	Maths,physics			nithin
MYSHA AIYAS AGA	+97470455389 ,+97466695491	QATAR	X	CBSE	Monday, Wednesday, Satur	21:30:00	3000 RUPEES	12 Classes - Monthly Package (3 Classes/week)	06/07/2026	MATHS			maha
Liam Ahamed 	+1 (365) 378‑2735	Canada 	1	CBSE	Monday, Tuesday, Wednesday, Thursday, Satur, Sunday	08:00:00	1200	8 classes 	06/07/2026	Arabic 			vafa
Ritvika Vipinkumar 	9745364252	Adoor 	10th STD 	CBSE	Monday, Wednesday, Thursday	18:00:00	3000	3 Class Per Week	09/07/2026	Social, Maths  & Chemistry 			maha
Vagisha Varun Nair	9746896706	KAZHAKOOTAM, THIRUVANATHAPURAM	9	CBSE	Tuesday, Wednesday, Thursday	20:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	14/07/2026	PHYSICS, CHEMISTRY, MATHEMATICS			aswani ,neha
Saatvik Arjun 	973 39013039	Bahrain	10	CBSE	Monday, Tuesday, Wednesday, Thursday, Satur, Sunday	12:00:00	6500	20 Classes - Monthly Package ( 5 Classes/week)	15/07/2026	Maths,Physics, Chemistry 			maha,neha
Joel Antony Alfred	9946282308	Pallipuram, Ernakulam	9	CBSE	Thursday, Friday	06:30:00	Yes	8 classes ( 2 classes per week)	16/07/2026	Maths			ibrahim
Abdullah Bin Abu Thahir	+971525273030	SHARJAH	7th	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	19:00:00	6000	6 days weekly	23/07/2026	English , Maths ,Science, social studies & Malayalam			aswathi b, shilpa, abdullah
ANLIYA MS	9847992848 & +966536422326	ARTHAT	6	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	18:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	27/07/2026	Hindi, English, Math's, Social, Science.			
Vishnu S Viswanath 	8547000979	Thalassery, Kannur	Class 10	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	19:20:00	Rs.6000/-	6 classes per week 	24/07/2026	Physics, Biology, Maths			shahara
Rihan Subair	+968 72208043	Sur,Oman	12	CBSE	Thursday, Friday, Satur, Sunday	07:30:00	6000	16 Classes - Monthly Package (4 Classes / Week )	24/07/2026	Physics and Chemistry 			neha
Nehal Vimal Dev 	7893065075	Visakhapatnam 	VI	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	19:15:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	03/08/2026	All subjects			hudha
NS Karthik 	0097431507361	Qatar 	7	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	04:00:00	6500	6 class per week	01/08/2026	Science, SST			anjana
Aptha Ratheesh 	8086587504	Pattambi	6	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	18:30:00	8500	8	05/08/2026	Hindi malayalam ss gs 4 subject 			anjana
Fathima Anjoom	+971-554959830	Dubai	XII-Science	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	11:00:00	9000	25 Classes - Monthly package (4 weeks)	10/08/2026	Physics, Chemistry and Maths			NEHA VIPANYA FOUZANATH
Mohammad hanan. V	9400810934	Dubai	6	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	16:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	13/08/2026	English			JASNA
Fathima aina. V	9400810934	Dubai	2	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	11:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	13/08/2026	English 			RISWANA
Siya Fathima Sanis	00971507495159	UAE	6	CBSE	Monday, Tuesday, Wednesday		3000	12 Classes - Monthly Package (3 Classes/week)	17/08/2026	Maths			MARIYA
Rayan Shamseer	+966564822415	Kannur	Plus one	CBSE	Monday, Wednesday, Thursday, Satur	19:00:00	6000	16 Classes - Monthly Package (4 Classes / Week )	15/08/2026	Maths			NITHIN
Zainab Shamseer	+966564822415	Kannur	8	CBSE	Monday, Wednesday, Satur	19:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	15/08/2026	Maths			SREELAKSHMI
Adhrit poonoth	9747250039	Vilayur palakkad	3	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	18:30:00	6000rs	12 Classes - Monthly Package (3 Classes/week)	03/09/2026	Hindi Malayalam 			HUDHA , SNEHA
Rahul B Mohan	9048241265	Ernakulam	12	CBSE	Monday, Wednesday, Friday	19:30:00	4000	12 Classes - Monthly Package (3 Classes/week)	17/08/2026	Chemistry			NEHA
Aafreen Fathima	971567263936	UAE	9th	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	05:00:00	6000	24classes -Monthly package (6Classes/week)	29/08/2026	Maths and Science			SREELAKSHMI
Alna Theresa Vibin 	0096897657594	Muscat	10	CBSE	Monday, Tuesday, Wednesday, Satur, Sunday	18:30:00	3000	12 Classes - Monthly Package (3 Classes/week)	01/09/2026	English 			SHILPA
EBIN SEBASTIAN 	55448723	Kuwait 	8	CBSE	Monday, Tuesday, Wednesday, Thursday, Sunday	19:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	01/09/2026	 MATH & FRENCH 			SREELAKSHMI
Adwika Deepu	+971568304350	Abu Dhabi	8	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday, Satur	20:30:00	6000Rs	24 classes per month(6 per week)	02/09/2026	Maths, Science, Hindi, Arabic			SUHAILA
Sayyid Ahmad Fazal	+965 65664543	Kuwait 	IX	CBSE	Monday, Wednesday, Thursday	18:30:00	3000	12 Classes - Monthly Package (3 Classes/week)	03/09/2026	Maths French 			MARIA
Janoah Varghese Tinu	00966553256399	Saudi Arabia 	10th	CBSE	Monday, Tuesday, Wednesday, Thursday, Sunday	18:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	06/09/2026	Maths and science 			MAHA
Ayisha Ezrin 	52 339 6061 	UAE	9th	CBSE	Tuesday, Thursday, Satur	20:30:00	3000Rs	12 Classes - Monthly Package (3 Classes/week)	09/04/0026	Science (physics,chemistry,biology)			ANJANA
Sara susan ronny	8848033732	Chenganuur 	5th	CBSE	Monday, Tuesday, Wednesday	08:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	04/09/2026	Maths			THABSHEERA
Azza Mehak A. A	9746475442	Kumaranellu p.o, Kudumb, Thrissur district 	1	CBSE	Tuesday, Thursday, Satur	19:30:00	3000	12 Classes - Monthly Package (3 Classes/week)	05/09/2026	Maths, evs, English 			FEBIN
Maryam Nizam 	974 77115253	Qatar	6	CBSE	Friday, Satur	11:00:00	3000	Weekly 2 classes one and half hour each	05/09/2026	Arabic 			VAFA
Joseph George kottayil	9947795664	Muvatupuzha 	7	ICSE	Thursday, Friday, Satur	08:30:00	3000 RS	12 Classes - Monthly Package (3 Classes/week)	11/09/2026	Hindi			GOPIKA
Yara Zainab 	971 56 611 5516 	Dubai	7	CBSE	Tuesday, Friday, Satur	17:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	12/09/2026	Maths			RAMSEENA
Maryam 	00971566115111	Calicut 	Grade 6 	CBSE	Tuesday, Friday, Satur	18:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	11/09/2026	Math			RAMSEENA
Adharv Sony	+97455657193	Qatar	9	CBSE	Thursday, Friday, Satur		3000	12 Classes - Monthly Package (3 Classes/week)	10/09/2026	Maths			AYSHA FINU
Delna Vinu 	9526899417	Koothattukulam 	2	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	07:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	09/09/2026	Total			RISWANA
Anand krishna.p	00971504914960	UAE	10 th	CBSE	Monday, Thursday, Satur, Sunday	22:11:00	4000	16 Classes - Monthly Package (4 Classes / Week )	26/09/0010	Arabic			VAFA
Josh N Nidhiry 	9744105343	Ernakulam 	Grade 8	CBSE	Monday, Wednesday, Friday	05:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	11/09/2026	Maths, English and Chemistry 			RAMSEENA
AADHISANKAR 	971561456924	Sharjah 	4	CBSE	Friday, Satur, Sunday	20:00:00	1500	20 Classes - Monthly Package ( 5 Classes/week)	10/09/2026	Arabic, Maths			SAMVRITHA, VAFA
ANVITHA SARATH 	971561456924	Sharjah 	7	CBSE	Friday, Satur, Sunday	20:00:00	1500	20 Classes - Monthly Package ( 5 Classes/week)	10/09/2026	Arabic,Maths			VAFA
Sainika Ragupathy	+918825607154	Iceland	3rd grade	Cambridge 	Monday, Wednesday, Friday	22:30:00	11,000	12 Classes - Monthly Package (3 Classes/week)	14/09/2026	English and Maths			SANDRA
Ayisha 	91 7510149269	Tvm 	12	CBSE	Thursday, Friday, Satur	08:00:00	4000	12 Classes - Monthly Package (3 Classes/week)	17/09/2026	Chemistry 			NEHA
Neha. T	+918891550649	Qatar 	10	CBSE	Monday, Tuesday, Wednesday, Friday, Satur		5000	20 Classes - Monthly Package ( 5 Classes/week)	16/09/2026	Maths social science 			MAHA. ARSHA
Tanvika Vipin	8861022202 , 9539598655	Ernakulam	3	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	19:30:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	17/09/2026	Science, social, English, Malayalam,Hindi			GOPIKA
Ishaan R Kumar	9342347381	Trivandrum	5	ICSE	Wednesday	17:30:00	1200	4 classes	16/09/2026	Maths			RAMSEENA
vishnu dev.m	8714770664	pokkun	11th	Kerala State	Monday, Tuesday, Wednesday, Thursday, Friday, Satur, Sunday	12:00:00	7500	20 Classes - Monthly Package ( 5 Classes/week)	18/09/2026	maths phy bio			VIPANYA
Karthik jayesh 	8086758221	UAE	8	CBSE	Monday, Tuesday, Thursday, Friday, Satur, Sunday	19:30:00	1800	6 days class	17/09/2026	Arabic			SHAHANA
DANIEL JACOB JOY 	±971502905257	Abu Dhabi 	8	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	18:08:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	21/09/2026	Math and Science			SREELAKSHMI
Aiden Thomas Manu	+919961578304	Dubai	Grade 1	CBSE	Monday, Wednesday, Thursday	17:15:00	3000	12 Classes - Monthly Package (3 Classes/week)	21/09/2026	Arabic, Social Science, English			SHAHANA, ARSHA,HUDA
MUHAMMED ISMAIL	8714137174	Feroke	9th	CBSE	Monday, Tuesday, Wednesday, Thursday, Friday	07:30:00	5k	20 Classes - Monthly Package ( 5 Classes/week)	23/09/2026	Maths social science ( chemistry , physics, biology)			RAMSEENA
Catherine Pratheesh 	8593057154	Alappuzha,kattoor	8th	CBSE	Thursday	20:00:00	1200	4 classes -monthly	24/09/2026	Maths 			SNEHA
Jaslyn Rathna 	+965 55967742	Kuwait 	4	CBSE	Tuesday, Thursday, Sunday	19:30:00	2000	12 Classes - Monthly Package (3 Classes/week)	24/09/2026	Maths			NIKITA
Saketh Sanal 	9633302518	Pariyaram, Kannur	6	CBSE	Monday, Wednesday, Thursday	16:30:00	3000	12 Classes - Monthly Package (3 Classes/week)	24/09/2026	Malayalam & Hindi			ADITHYA,ASWATHY
Catherine Maria Benny 	0564659350	Dubai 	Grade-3	British 	Monday, Wednesday	04:30:00	2400 inr	8 classes- Monthly package (2 classes/week)	28/09/2026	Arabic 			SHAHANA
Ann Anna Paul 	0563117432	Saudi Arabia  [Riyadh]	10th	CBSE	Thursday, Friday, Satur	06:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	01/10/2026	Social science, Chemistry, Malayalam 			ARSHA, NEHA,ASWATHY
Dharmika SA	8907629170	Puthussery ( kollam dis(	1st standard	CBSE	Monday, Wednesday, Thursday, Satur	07:08:00	3000	16 Classes - Monthly Package (4 Classes / Week )	26/09/2026	Malayalam,English,EVS,Hindi			AYSHA MINHA
Mikha Maria Sibi 	09744551085	Kottayam	3	CBSE	Monday, Tuesday, Wednesday	18:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	10/05/2026	English ,Hindi and Social Studies 			GAYATHRI
Richard mahesh george	65015790	Kuwait	12th	CBSE	Monday, Tuesday, Wednesday, Thursday, Sunday	05:30:00	12000	20 classes physics and 12 classes chemistry	29/09/2026	Chemistry and physics 			NISHANA.NEHA
Muhammed Thameem 	9446581079	Thrissur 	9	CBSE	Wednesday, Thursday, Friday, Satur, Sunday	08:30:00	Yes	10 classes	30/09/2026	Arabic 			SHAHANA
Adrika Deepu	0568304350	Abu Dhabi	3	CBSE	Tuesday, Wednesday, Thursday	20:30:00	3000	12 Classes - Monthly Package (3 Classes/week)	01/10/2026	Hindi, Arabic			
Eshan	9946931453	Kozhikode 	10	CBSE	Tuesday, Satur, Sunday		3000	3 class per week	03/10/2026	Maths			
Ayden Stephen	00971547429960	Abu dhabi, UAE	5	CBSE	Monday, Wednesday, Friday	18:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	03/10/2026	Arabic			
Mohammed Jahiz 	0504514879	Dubai	9	CBSE	Monday, Tuesday, Thursday, Friday, Satur	20:00:00	5000	20 Classes - Monthly Package ( 5 Classes/week)	03/10/2026	Maths, science 			
Sreya Sreejith 	9207242607	Pandalam, Pathanamthitta 	9th standard 	CBSE	Monday, Tuesday, Wednesday, Thursday	18:07:00	4000	16 Classes - Monthly Package (4 Classes / Week )	05/10/2026	English, Mathematics, Science, Social Science 			
Izaan	056-1336384	Dubai	10	CBSE	Monday, Wednesday, Thursday, Friday, Satur, Sunday	08:30:00	9000	3 class in a week for physics chemistry and biology 	05/10/2026	Science 			
Slaine	9446511500	Kuwait 	10	CBSE	Tuesday, Wednesday, Sunday	17:30:00		12 Classes - Monthly Package (3 Classes/week)	10/07/2026	Maths			
Mridul. S	9048475778	Edappon, MAVELIKARA 	6	CBSE	Monday, Wednesday, Friday	20:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	07/10/2026	Hindi, Science, Social studies 			
Vamika Nyrah	971569965645	Dubai, United Arab Emirates	KG1	CBSE	Monday, Wednesday, Friday	18:00:00	3000	12 Classes - Monthly Package (3 Classes/week)	07/10/2026	English			`;

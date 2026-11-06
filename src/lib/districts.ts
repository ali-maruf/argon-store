// All 64 districts of Bangladesh, grouped by division.
export const DIVISIONS: Record<string, string[]> = {
  Dhaka: ["Dhaka", "Gazipur", "Narayanganj", "Narsingdi", "Manikganj", "Munshiganj", "Faridpur", "Gopalganj", "Madaripur", "Rajbari", "Shariatpur", "Kishoreganj", "Tangail"],
  Chattogram: ["Chattogram", "Cox's Bazar", "Cumilla", "Brahmanbaria", "Chandpur", "Feni", "Lakshmipur", "Noakhali", "Khagrachhari", "Rangamati", "Bandarban"],
  Rajshahi: ["Rajshahi", "Bogura", "Joypurhat", "Naogaon", "Natore", "Chapainawabganj", "Pabna", "Sirajganj"],
  Khulna: ["Khulna", "Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"],
  Barishal: ["Barishal", "Barguna", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  Sylhet: ["Sylhet", "Habiganj", "Moulvibazar", "Sunamganj"],
  Rangpur: ["Rangpur", "Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Thakurgaon"],
  Mymensingh: ["Mymensingh", "Jamalpur", "Netrokona", "Sherpur"],
};
export const DISTRICTS = Object.values(DIVISIONS).flat().sort();

export const AREAS: Record<string, string[]> = {
  Dhaka: [
    "Adabor", "Badda", "Banani", "Bangshal", "Bashundhara", "Cantonment", "Chawkbazar", "Dakshinkhan", "Darus Salam", "Demra", "Dhanmondi", "Gendaria", "Gulshan", "Hazaribagh", "Jatrabari", "Kadamtali", "Kafrul", "Kalabagan", "Kamrangirchar", "Khilgaon", "Khilkhet", "Kotwali", "Lalbagh", "Mirpur", "Mohammadpur", "Motijheel", "Mugda", "New Market", "Pallabi", "Paltan", "Ramna", "Rampura", "Sabujbagh", "Shah Ali", "Shahbagh", "Sher-e-Bangla Nagar", "Shyampur", "Sutrapur", "Tejgaon", "Turag", "Uttara", "Uttarkhan", "Vatara", "Wari",
    "Savar", "Ashulia", "Keraniganj", "Dhamrai", "Dohar", "Nawabganj",
  ],
  Gazipur: ["Gazipur Sadar", "Tongi", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur"],
  Narayanganj: ["Narayanganj Sadar", "Fatullah", "Siddhirganj", "Bandar", "Rupganj", "Sonargaon", "Araihazar"],
  Chattogram: ["Agrabad", "Bayazid", "Chandgaon", "Double Mooring", "Halishahar", "Khulshi", "Kotwali", "Pahartali", "Panchlaish", "Patenga", "Hathazari", "Patiya", "Sitakunda", "Mirsharai", "Raozan", "Boalkhali", "Anwara", "Banshkhali", "Sandwip", "Rangunia", "Fatikchhari", "Lohagara", "Satkania", "Chandanaish", "Karnaphuli"],
  Sylhet: ["Sylhet Sadar", "Beanibazar", "Golapganj", "Companiganj", "Fenchuganj", "Bishwanath", "Jaintiapur", "Kanaighat", "Zakiganj", "Osmani Nagar", "Balaganj", "Gowainghat", "Dakshin Surma"],
  Rajshahi: ["Boalia", "Rajpara", "Motihar", "Shah Makhdum", "Paba", "Godagari", "Tanore", "Bagha", "Charghat", "Durgapur", "Mohanpur", "Puthia", "Bagmara"],
  Khulna: ["Khulna Sadar", "Sonadanga", "Khalishpur", "Daulatpur", "Khan Jahan Ali", "Batiaghata", "Dumuria", "Dighalia", "Rupsha", "Phultala", "Terokhada", "Paikgachha", "Koyra", "Dacope"],
};

/** Default zone mapping. The admin can override districts/areas per zone in Shipping settings. */
export const SUB_DHAKA_AREAS = ["Savar", "Ashulia", "Keraniganj", "Dhamrai", "Dohar", "Nawabganj"];
export const SUB_DHAKA_DISTRICTS = ["Gazipur", "Narayanganj"];

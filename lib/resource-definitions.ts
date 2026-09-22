export const RESOURCE_FIELDS:Record<string,string[]>={
students:["student_number","first_name","last_name","email","phone","year_of_study","admission_year","status"],
clubs:["name","slug","description","status"],courses:["code","name","credits","department_id"],
events:["club_id","title","description","start_at","end_at","venue","capacity","status"],
event_registrations:["event_id","student_id","status"],
event_attendance:["event_id","student_id","method"],
certificates:["event_id","student_id","certificate_number","title","status"],
notices:["title","body","published_at","expires_at","status"],
notifications:["profile_id","title","body","read_at"],
circulars:["title","body","published_at","expires_at","status"],
deadlines:["title","description","due_at","status"],
timetable_entries:["course_id","faculty_id","day_of_week","start_time","end_time","room"],
exams:["course_id","name","starts_at","room","max_marks","status"],
academic_attendance_sessions:["course_id","faculty_id","starts_at"],
academic_attendance:["session_id","student_id","present"],
marks:["course_id","student_id","assessment_name","score","max_score"],
achievements:["student_id","title","category","description","achieved_on"],
activity_records:["student_id","activity_type","reference_id","description"],
participation_records:["event_id","student_id","role"]
};
export const RESOURCE_TABLES=new Set(Object.keys(RESOURCE_FIELDS));
export function cleanPayload(resource:string,body:Record<string,unknown>){const allowed=RESOURCE_FIELDS[resource]||[];return Object.fromEntries(Object.entries(body).filter(([key])=>allowed.includes(key)&&body[key]!==""&&body[key]!==undefined));}
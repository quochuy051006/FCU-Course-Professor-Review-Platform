import axios from 'axios';
import fs from 'fs';

const URL = "https://coursesearch02.fcu.edu.tw/Service/Search.asmx/GetType1Result";

const units = [
    { name: "永續處", id: "SG" }, { name: "創能學院", id: "CC" },
    { name: "通識中心", id: "GE" }, { name: "工科學院", id: "CA" },
    { name: "商學院", id: "CB" }, { name: "人社學院", id: "CH" },
    { name: "資電學院", id: "CI" }, { name: "建設學院", id: "CD" },
    { name: "金融學院", id: "CF" }, { name: "國際科技與管理學院", id: "NM" },
    { name: "建築專業學院", id: "AS" }, { name: "外語文", id: "XA" },
    { name: "體育選項課", id: "XD" }, { name: "統籌科目", id: "XF" },
    { name: "軍訓", id: "XH" }
];

async function fetchAllCourses() {
    let allCourses = []; 

    for (const unit of units) {
        console.log(`Đang cào khoa: ${unit.name} (${unit.id})...`);
        
        try {
            const payload = {
                "baseOptions": { "lang": "cht", "year": 115, "sms": 1 },
                "typeOptions": { "degree": "1", "deptId": unit.id, "unitId": "*", "classId": "*" }
            };

            const response = await axios.post(URL, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Referer': 'https://coursesearch02.fcu.edu.tw/'
                }
            });

            if (response.data && response.data.items) {
                // ĐÂY LÀ CHỖ QUAN TRỌNG: Gán dept_id cho từng môn học
                const coursesWithDept = response.data.items.map(course => ({
                    ...course,
                    dept_id: unit.id // Thêm thuộc tính dept_id vào object môn học
                }));

                allCourses = allCourses.concat(coursesWithDept);
                console.log(`> Xong ${unit.name}: ${coursesWithDept.length} môn.`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`! Lỗi khoa ${unit.name}:`, error.message);
        }
    }

    // Tự động ghi đè lên file cũ, ông không cần xóa gì cả
    fs.writeFileSync('all_courses_1151.json', JSON.stringify(allCourses, null, 2));
    console.log(`\n=== HOÀN TẤT! Tổng cộng: ${allCourses.length} môn học đã được lưu với thông tin khoa. ===`);
}

fetchAllCourses();
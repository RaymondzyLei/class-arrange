#
# Derived from: https://github.com/feixukeji/paike
# Original Copyright (c) 2025-2026 Xulei Sun, Brealid, Determinant and contributors
# Modified by RaymondzyLei, 2026
#
# This file is licensed under the GNU Affero General Public License v3.0.
# See the COPYING file in the repository root for full license text.
#
# Modifications:
# - Adapted course data parsing and matching logic for this project's data format
#
import json
import hashlib

hashstr = lambda x: hashlib.sha256(x.encode('utf-8')).hexdigest()

to_abandon_datacase = {
    '955',  # 力学 (刘斌) [重复课程]
}

with open('icourse_spider/course_rating.json', 'r', encoding='utf-8') as f:
    course_data = json.load(f)
mapping = {}
for course in course_data:
    specifyInfo = course['name'] + '#' + str(sorted(course['teachers']))
    specifyInfo = hashstr(specifyInfo)
    if course['score'] == '暂无评分':
        continue # 暂无评分的课程中有很大一部分出现了重复，这里直接忽略
    if course['icourse-id'] in to_abandon_datacase:
        continue # 有些课程的评分数据有误，这里直接忽略
    # assert specifyInfo not in mapping, course['icourse-id']
    mapping[specifyInfo] = course['score']

def get_icourseRating(courseName, teachers):
    specifyInfo = courseName + '#' + str(sorted(teachers))
    specifyInfo = hashstr(specifyInfo)
    if specifyInfo in mapping:
        return mapping[specifyInfo]
    return "暂无评分"

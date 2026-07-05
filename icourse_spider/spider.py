# ----------------------------------------------------------------------------
# 本文件来自 https://github.com/feixukeji/paike （USTC 排课 / 评课爬虫项目）
# 原作者贡献的 icourse.club 评分爬虫实现（多进程并发拉取课程名 + 教师 +
# 评分）。本仓库保留原始代码，不做改动；前端消费评分数据的脚本在
# scripts/ratings_to_ts.py。
# ----------------------------------------------------------------------------
# 必要的依赖项
import requests
import json, re
import multiprocessing
import tqdm
import time

old_requests_get = requests.get
def auto_retry_get(*args, **kwargs):
    try_cnt = 0
    while True:
        try:
            return old_requests_get(*args, **kwargs)
        except:
            try_cnt += 1
            print(f"{args[0]} Retry {try_cnt}")
            if try_cnt > 10:
                print(f"{args[0]} Failed")
                return None
requests.get = auto_retry_get


# 预定义数据
process_max = 8
spider_allcourse_cnt = process_max * 4


# 从 https://icourse.club/course/?page={pageid} 中抓取数据
def get_all_courses(start_page=1, step=1):
    pageid = start_page
    allcourses = []
    while True:
        url = f'https://icourse.club/course/?page={pageid}'
        r = requests.get(url)
        if r.status_code != 200:
            break
        # 寻找所有 <a class="px16" href="/course/xxxxx/"> 的内容
        courses = re.findall(r'<a class="px16" href="/course/(\d+)/">', r.text)
        allcourses.extend(courses)
        pageid += step
    return allcourses
        
def mp_get_all_courses(x):
    return get_all_courses(*x)

# 从 https://icourse.club/course/{courseid}/ 中抓取数据
def get_lesson_data(lessonid):
    url = f'https://icourse.club/course/{lessonid}/'
    r = requests.get(url)
    if (r == None) or (r.status_code != 200):
        return lessonid, None, None, '课程评分获取失败', None
    # 寻找课程名，形如 <span class="blue h3">大学物理-研究性实验</span><span class="h3 blue mobile">
    name = re.findall(r'<span class="blue h3">(.+)</span><span class="h3 blue mobile">', r.text)
    if len(name) == 0:
        return lessonid, None, None, '课程名获取失败', None
    # 检测是否暂无评分，依据是是否出现过 <span class="text-muted px12">(暂无评价)</span>
    isNoScoreNow = r.text.find(r'<span class="text-muted px12">(暂无评价)</span>') != -1
    # 获取课程评价信息，形如 <span class="rl-pd-sm h4">xxx</span>
    score = re.findall(r'<span class="rl-pd-sm h4">([0-9.]+)</span>', r.text)
    if not isNoScoreNow and len(score) == 0:
        return lessonid, name[0], None, '课程评分获取失败', None
    count = re.findall(r'(\d+)\s*人评价', r.text)
    # 获取所有老师, 形如 <h3 class="blue"><a href="/teacher/29/">许小亮</a></h3>
    teachers = re.findall(r'<h3 class="blue"><a href="/teacher/\d+/">(.+)</a></h3>', r.text)

    if isNoScoreNow:
        return lessonid, name[0], teachers, '暂无评分', None
    return lessonid, name[0], teachers, score[0], int(count[0]) if count else None


if __name__ == '__main__':

    # 多线程处理: 获取所有课程
    start_time = time.time()
    allcourses = []
    print(f'[+] 爬取课程列表的工作已被划分为 {spider_allcourse_cnt} 个 part, 将使用多线程进行处理')
    with tqdm.tqdm(total=spider_allcourse_cnt, desc='[o] 正在爬取课程列表, 预计花费时间 90s', unit='part') as pbar:
        with multiprocessing.Pool(processes=process_max) as pool:
            spider_args = [(i, spider_allcourse_cnt) for i in range(1, spider_allcourse_cnt + 1)]
            for courses in pool.imap_unordered(mp_get_all_courses, spider_args):
                allcourses.extend(courses)
                pbar.update()
    time_cost = time.time() - start_time
    print(f'[+] 已获取所有课程 (共 {len(allcourses)} 门, 耗时 {time_cost:.2f} 秒)')

    # 多线程处理: 获取所有评分数据
    start_time = time.time()
    results = []
    with multiprocessing.Pool(processes=process_max) as pool:
        with tqdm.tqdm(total=len(allcourses), desc='[o] 正在爬取评分数据') as pbar:
            for lessonid, name, teachers, score, ratingCount in pool.imap_unordered(get_lesson_data, allcourses):
                if '获取失败' in score:
                    print(f'[x] 课程 {lessonid} {score}')
                    continue
                item = {
                    'icourse-id': lessonid,
                    'name': name,
                    'teachers': teachers,
                    'score': score
                }
                if ratingCount is not None:
                    item['ratingCount'] = ratingCount
                results.append(item)
                pbar.update()
    time_cost = time.time() - start_time
    print(f'[+] 已获取所有评分数据 (耗时 {time_cost:.2f} 秒)')

    # 保存数据
    with open('course_rating.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=4)
    

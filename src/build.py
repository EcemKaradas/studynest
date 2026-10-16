import os
d=os.path.dirname(os.path.abspath(__file__))
r=lambda n:open(os.path.join(d,n),encoding='utf8').read()
html=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#7c6cf0">
<title>StudyNest | Study planner for students</title>
<meta name="description" content="StudyNest is a calm study planner for students: timetable, exam prep with progress tracking, assignments, group projects and daily, weekly and monthly lists.">
<meta property="og:title" content="StudyNest">
<meta property="og:description" content="A calm study planner: timetable, exam prep progress, assignments and group projects.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Ctext y=%27.9em%27 font-size=%2790%27%3E%F0%9F%8C%B1%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
{r('style.css')}
</style>
</head>
<body>
<div id="app"></div>
<script>
{r('core.js')}
{r('views.js')}
{r('assistant.js')}
{r('actions.js')}
</script>
</body>
</html>
'''
open(os.path.join(d,'..','index.html'),'w',encoding='utf8').write(html)
open(os.path.join(d,'bundle.js'),'w',encoding='utf8').write(r('core.js')+r('views.js')+r('assistant.js')+r('actions.js'))
print(len(html))
